import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SecureImageDownloader } from "./secure-image-downloader";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";

const settings: VocabularyMediaSettings = {
  enabled: true,
  apiKey: "test",
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

test("secure downloader rejects non-allowlisted hosts and redirect escapes", async () => {
  const downloader = new SecureImageDownloader(settings, async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private.png" },
    }));
  await assert.rejects(
    downloader.download("https://example.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_REJECTED",
  );
  await assert.rejects(
    downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_REJECTED",
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
  ));

  const mismatch = new SecureImageDownloader(settings, async () =>
    new Response(valid as unknown as BodyInit, { headers: { "content-type": "image/jpeg" } }));
  await assert.rejects(mismatch.download(
    "https://cdn.pixabay.com/a.jpg",
    ["cdn.pixabay.com"],
  ));

  const small = await png(100, 100);
  const invalidDimensions = new SecureImageDownloader(settings, async () =>
    new Response(small as unknown as BodyInit, { headers: { "content-type": "image/png" } }));
  await assert.rejects(invalidDimensions.download(
    "https://cdn.pixabay.com/a.png",
    ["cdn.pixabay.com"],
  ));
});

test("secure downloader maps network timeouts to a stable import error", async () => {
  const downloader = new SecureImageDownloader(settings, async () => {
    throw new DOMException("timed out", "TimeoutError");
  });
  await assert.rejects(
    downloader.download("https://cdn.pixabay.com/a.png", ["cdn.pixabay.com"]),
    (error: unknown) => (error as { code?: string }).code === "IMAGE_IMPORT_REJECTED",
  );
});
