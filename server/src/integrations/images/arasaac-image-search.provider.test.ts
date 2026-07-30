import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error";
import { ArasaacImageSearchProvider } from "./arasaac-image-search.provider";

const input = {
  query: "brush teeth",
  page: 1,
  pageSize: 8,
  mediaType: "ILLUSTRATION" as const,
  orientation: "ALL" as const,
  safeSearch: true as const,
};

test("ARASAAC maps, filters and deduplicates pictograms without changing relevance order", async () => {
  let requested = "";
  let calls = 0;
  const provider = new ArasaacImageSearchProvider(async (url) => {
    requested = String(url);
    calls += 1;
    return Response.json([
      {
        _id: 42,
        violence: false,
        keywords: [{ keyword: "brush teeth" }, { keyword: "toothbrush" }],
        categories: ["health"],
        tags: ["routine"],
      },
      { _id: 99, violence: true, keywords: [{ keyword: "violent" }] },
      { _id: 42, violence: false, keywords: [{ keyword: "duplicate" }] },
      { _id: 7, keywords: [{ keyword: "teeth" }] },
      { _id: 0 },
      { _id: "bad" },
    ]);
  });

  const result = await provider.search(input);
  assert.equal(calls, 1);
  assert.equal(requested, "https://api.arasaac.org/v1/pictograms/en/bestsearch/brush%20teeth");
  assert.equal(result.total, 2);
  assert.deepEqual(result.items.map((item) => item.providerAssetId), ["42", "7"]);
  assert.equal(result.items[0].provider, "ARASAAC");
  assert.equal(result.items[0].previewUrl, "https://static.arasaac.org/pictograms/42/42_300.png");
  assert.equal(result.items[0].thumbnailUrl, "https://static.arasaac.org/pictograms/42/42_300.png");
  assert.equal(result.items[0].downloadUrl, "https://static.arasaac.org/pictograms/42/42_500.png");
  assert.deepEqual(result.items[0].tags, ["brush teeth", "toothbrush", "health", "routine"]);
  assert.equal(result.items[0].mediaType, "ILLUSTRATION");
  assert.equal(result.items[0].licenseLabel, "CC BY-NC-SA");
  assert.match(result.items[0].attributionText, /Sergio Palao.*ARASAAC.*Government of Aragón/);
});

test("ARASAAC paginates one upstream result without extra API calls", async () => {
  let calls = 0;
  const provider = new ArasaacImageSearchProvider(async () => {
    calls += 1;
    return Response.json([{ _id: 1 }, { _id: 2 }, { _id: 3 }]);
  });
  const result = await provider.search({ ...input, page: 2, pageSize: 2 });
  assert.equal(calls, 1);
  assert.equal(result.total, 3);
  assert.deepEqual(result.items.map((item) => item.providerAssetId), ["3"]);
});

test("ARASAAC accepts an empty search result", async () => {
  const result = await new ArasaacImageSearchProvider(async () => Response.json([])).search(input);
  assert.deepEqual(result, { total: 0, items: [] });
});

test("ARASAAC retries timeout/network exactly once and reports sanitized details", async () => {
  for (const failure of [
    new DOMException("timeout", "AbortError"),
    new TypeError("socket closed"),
  ]) {
    let calls = 0;
    const waits: number[] = [];
    const fetcher = async () => { calls += 1; throw failure; };
    await assert.rejects(
      new ArasaacImageSearchProvider(fetcher, 5_000, async (milliseconds) => {
        waits.push(milliseconds);
      }, () => 0.5).search(input),
      (error: unknown) => error instanceof AppError &&
        error.code === "IMAGE_PROVIDER_UNAVAILABLE" && error.statusCode === 503 &&
        (error.details as { provider?: string }).provider === "ARASAAC" &&
        (error.details as { operation?: string }).operation === "SEARCH" &&
        (error.details as { reason?: string }).reason === (failure.name === "AbortError" ? "TIMEOUT" : "NETWORK"),
    );
    assert.equal(calls, 2);
    assert.deepEqual(waits, [850]);
  }
});

test("ARASAAC does not retry malformed responses", async () => {
  for (const response of [
    () => new Response("not-json", { status: 200 }),
    () => Response.json({ unexpected: true }),
  ]) {
    let calls = 0;
    await assert.rejects(
      new ArasaacImageSearchProvider(async () => { calls += 1; return response(); }, 5_000,
        async () => undefined).search(input),
      (error: unknown) => error instanceof AppError &&
        error.code === "IMAGE_PROVIDER_UNAVAILABLE" &&
        (error.details as { reason?: string }).reason === "MALFORMED_RESPONSE",
    );
    assert.equal(calls, 1);
  }
});

test("ARASAAC preserves Retry-After, retries selected 5xx once and does not retry other statuses", async () => {
  let rateLimitCalls = 0;
  await assert.rejects(
    new ArasaacImageSearchProvider(async () => { rateLimitCalls += 1; return new Response(null, {
      status: 429,
      headers: { "Retry-After": "9" },
    }); }).search(input),
    (error: unknown) => error instanceof AppError &&
      error.code === "IMAGE_PROVIDER_RATE_LIMITED" &&
      error.statusCode === 429 && error.retryAfterSeconds === 9,
  );
  assert.equal(rateLimitCalls, 1);

  for (const status of [500, 502, 503, 504]) {
    let calls = 0;
    await assert.rejects(
      new ArasaacImageSearchProvider(async () => { calls += 1; return new Response(null, { status }); },
        5_000, async () => undefined).search(input),
      (error: unknown) => error instanceof AppError &&
        error.code === "IMAGE_PROVIDER_UNAVAILABLE" &&
        (error.details as { upstreamStatus?: number }).upstreamStatus === status,
    );
    assert.equal(calls, 2);
  }
  for (const status of [400, 404]) {
    let calls = 0;
    await assert.rejects(
      new ArasaacImageSearchProvider(async () => { calls += 1; return new Response(null, { status }); },
        5_000, async () => undefined).search(input),
      (error: unknown) => error instanceof AppError &&
        error.code === "IMAGE_PROVIDER_UNAVAILABLE",
    );
    assert.equal(calls, 1);
  }
});

test("ARASAAC resolveAsset verifies a positive ID and reconstructs trusted URLs", async () => {
  let calls = 0;
  let requested = "";
  const provider = new ArasaacImageSearchProvider(async (url) => {
    calls += 1;
    requested = String(url);
    return Response.json({ _id: 42, keywords: [{ keyword: "apple" }] });
  });
  assert.equal(await provider.resolveAsset("0"), null);
  assert.equal(await provider.resolveAsset("-1"), null);
  assert.equal(await provider.resolveAsset("42.png"), null);
  assert.equal(calls, 0);

  const asset = await provider.resolveAsset("42");
  assert.equal(calls, 1);
  assert.equal(requested, "https://api.arasaac.org/v1/pictograms/en/42");
  assert.equal(asset?.providerAssetId, "42");
  assert.equal(asset?.downloadUrl, "https://static.arasaac.org/pictograms/42/42_500.png");
  assert.deepEqual(provider.allowedDownloadHosts, ["static.arasaac.org"]);
});

test("ARASAAC resolveAsset returns null for not found or invalid provider data", async () => {
  const notFound = new ArasaacImageSearchProvider(async () => new Response(null, { status: 404 }));
  assert.equal(await notFound.resolveAsset("42"), null);

  for (const payload of [[{ _id: 42 }], { _id: 41 }, { _id: 42, violence: true }]) {
    const provider = new ArasaacImageSearchProvider(async () => Response.json(payload));
    assert.equal(await provider.resolveAsset("42"), null);
  }
});
