import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SecureImageDownloader } from "./secure-image-downloader";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";

const settings: VocabularyMediaSettings = {
  enabled: true,
  arasaacEnabled: false,
  pixabayEnabled: true,
  pixabayApiKey: "test",
  storagePath: "unused",
  cacheTtlMs: 86_400_000,
  timeoutMs: 500,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 2,
  minDimension: 256,
  maxDimension: 4096,
  maxPixels: 16_000_000,
};

async function png(width = 300, height = 300): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#ef4444" },
  }).png().toBuffer();
}

test("secure downloader accepts an allowed raster and creates WebP renditions", async () => {
  const input = await png();
  const downloader = new SecureImageDownloader(settings, async () =>
    new Response(input as unknown as BodyInit, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(input.length) },
    }));
  const result = await downloader.download(
    "https://cdn.pixabay.com/photo.png",
    ["cdn.pixabay.com"],
  );
  assert.equal((await sharp(result.game).metadata()).format, "webp");
  assert.equal((await sharp(result.thumbnail).metadata()).width, 320);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
});

test("ARASAAC contain thumbnail preserves transparent padding without enlarging the game image", async () => {
  const input = await sharp({
    create: { width: 500, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: await sharp({
      create: { width: 180, height: 180, channels: 4, background: "#2563eb" },
    }).png().toBuffer(),
    left: 160,
    top: 60,
  }]).png().toBuffer();
  const downloader = new SecureImageDownloader(settings, async () =>
    new Response(input as unknown as BodyInit, {
      headers: { "content-type": "image/png" },
    }));
  const result = await downloader.download(
    "https://static.arasaac.org/pictograms/42/42_500.png",
    ["static.arasaac.org"],
    "contain",
  );
  const game = await sharp(result.game).metadata();
  const thumbnail = await sharp(result.thumbnail).metadata();
  assert.equal(game.format, "webp");
  assert.equal(game.width, 500);
  assert.equal(game.height, 300);
  assert.equal(game.hasAlpha, true);
  assert.equal(thumbnail.format, "webp");
  assert.equal(thumbnail.width, 320);
  assert.equal(thumbnail.height, 320);
  assert.equal(thumbnail.hasAlpha, true);
});

test("secure downloader rejects non-allowlisted hosts and redirect escapes", async () => {
  const downloader = new SecureImageDownloader(settings, async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private.png" },
    }));
  await assert.rejects(
    downloader.download("https://example.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_UNSAFE_REDIRECT",
  );
  await assert.rejects(
    downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_UNSAFE_REDIRECT",
  );
});

test("secure downloader rejects oversized, MIME-mismatched and invalid dimensions", async () => {
  const valid = await png();
  const oversized = new SecureImageDownloader({ ...settings, maxBytes: 100 }, async () =>
    new Response(valid as unknown as BodyInit, {
      headers: { "content-type": "image/png", "content-length": String(valid.length) },
    }));
  await assert.rejects(oversized.download(
    "https://cdn.pixabay.com/a.png",
    ["cdn.pixabay.com"],
  ), (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_TOO_LARGE");

  const mismatch = new SecureImageDownloader(settings, async () =>
    new Response(valid as unknown as BodyInit, { headers: { "content-type": "image/jpeg" } }));
  await assert.rejects(mismatch.download(
    "https://cdn.pixabay.com/a.jpg",
    ["cdn.pixabay.com"],
  ), (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_CONTENT_MISMATCH");

  const small = await png(100, 100);
  const invalidDimensions = new SecureImageDownloader(settings, async () =>
    new Response(small as unknown as BodyInit, { headers: { "content-type": "image/png" } }));
  await assert.rejects(invalidDimensions.download(
    "https://cdn.pixabay.com/a.png",
    ["cdn.pixabay.com"],
  ), (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_INVALID_DIMENSIONS");
});

test("secure downloader maps network timeouts to a stable import error", async () => {
  const downloader = new SecureImageDownloader(settings, async () => {
    throw new DOMException("timed out", "TimeoutError");
  });
  await assert.rejects(
    downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_TIMEOUT",
  );
});

test("secure downloader fails fast on upstream 429 without sleeping", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const downloader = new SecureImageDownloader(settings, async () => {
    calls += 1;
    return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  }, async (milliseconds) => { sleeps.push(milliseconds); });
  await assert.rejects(downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string; retryAfterSeconds?: number }).code === "IMAGE_IMPORT_SOURCE_RATE_LIMITED" &&
      (error as { retryAfterSeconds?: number }).retryAfterSeconds === 60);
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test("secure downloader retries timeout and 503 only once with short backoff", async () => {
  const input = await png();
  for (const failure of ["timeout", "503"] as const) {
    let calls = 0;
    const sleeps: number[] = [];
    const downloader = new SecureImageDownloader(settings, async () => {
      calls += 1;
      if (calls < 2) {
        if (failure === "timeout") throw new DOMException("timed out", "TimeoutError");
        return new Response(null, { status: Number(failure) });
      }
      return new Response(input as unknown as BodyInit, { headers: { "content-type": "image/png" } });
    }, async (milliseconds) => { sleeps.push(milliseconds); });
    await downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]);
    assert.equal(calls, 2);
    assert.equal(sleeps.length, 1);
    assert.ok(sleeps[0] <= 500);
  }
});

test("secure downloader never retries fixed validation failures", async () => {
  let calls = 0;
  const downloader = new SecureImageDownloader(settings, async () => {
    calls += 1;
    return new Response(Buffer.from("not-an-image") as unknown as BodyInit, { headers: { "content-type": "image/png" } });
  }, async () => undefined);
  await assert.rejects(downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]));
  assert.equal(calls, 1);
});
