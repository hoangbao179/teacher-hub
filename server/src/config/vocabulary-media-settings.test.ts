import assert from "node:assert/strict";
import test from "node:test";
import { resolveVocabularyMediaSettings } from "./vocabulary-media-settings";

test("vocabulary media stays disabled without an enabled provider", () => {
  const settings = resolveVocabularyMediaSettings({ NODE_ENV: "production" });
  assert.equal(settings.enabled, false);
  assert.equal(settings.cacheTtlMs, 86_400_000);
  assert.match(settings.storagePath, /vocabulary-media$/);
});

test("ARASAAC enables remote search without an API key", () => {
  const settings = resolveVocabularyMediaSettings({
    NODE_ENV: "production",
    ARASAAC_ENABLED: "true",
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.arasaacEnabled, true);
  assert.equal(settings.pixabayEnabled, false);
  assert.equal(settings.pixabayApiKey, "");
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

test("Pixabay key is optional while Pixabay is disabled", () => {
  const settings = resolveVocabularyMediaSettings({
    NODE_ENV: "production",
    ARASAAC_ENABLED: "true",
    PIXABAY_ENABLED: "false",
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.pixabayEnabled, false);
});

test("cache TTL cannot be configured below 24 hours", () => {
  assert.throws(
    () => resolveVocabularyMediaSettings({
      VOCABULARY_IMAGE_CACHE_TTL_MS: "3600000",
    }),
    /VOCABULARY_IMAGE_CACHE_TTL_MS/,
  );
});
