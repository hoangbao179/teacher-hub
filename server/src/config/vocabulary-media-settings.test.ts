import assert from "node:assert/strict";
import test from "node:test";
import { resolveVocabularyMediaSettings } from "./vocabulary-media-settings";

test("vocabulary media stays disabled without a provider key", () => {
  const settings = resolveVocabularyMediaSettings({ NODE_ENV: "production" });
  assert.equal(settings.enabled, false);
  assert.equal(settings.cacheTtlMs, 86_400_000);
  assert.match(settings.storagePath, /vocabulary-media$/);
});

test("enabled provider requires a key outside tests", () => {
  assert.throws(
    () => resolveVocabularyMediaSettings({
      NODE_ENV: "production",
      PIXABAY_ENABLED: "true",
    }),
    /PIXABAY_API_KEY/,
  );
});

test("cache TTL cannot be configured below 24 hours", () => {
  assert.throws(
    () => resolveVocabularyMediaSettings({
      VOCABULARY_IMAGE_CACHE_TTL_MS: "3600000",
    }),
    /VOCABULARY_IMAGE_CACHE_TTL_MS/,
  );
});
