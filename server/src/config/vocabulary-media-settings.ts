import path from "node:path";

export interface VocabularyMediaSettings {
  enabled: boolean;
  arasaacEnabled: boolean;
  pixabayEnabled: boolean;
  pixabayApiKey: string;
  storagePath: string;
  cacheTtlMs: number;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  minDimension: number;
  maxDimension: number;
  maxPixels: number;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const result = Number(env[name]?.trim() || fallback);
  if (!Number.isInteger(result) || result < min || result > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return result;
}

export function resolveVocabularyMediaSettings(
  env: NodeJS.ProcessEnv,
): VocabularyMediaSettings {
  const arasaacEnabled = enabled(env.ARASAAC_ENABLED);
  const pixabayEnabled = enabled(env.PIXABAY_ENABLED);
  const pixabayApiKey = env.PIXABAY_API_KEY?.trim() ?? "";
  if (pixabayEnabled && !pixabayApiKey && env.NODE_ENV !== "test")
    throw new Error("PIXABAY_API_KEY is required when PIXABAY_ENABLED=true");
  return {
    enabled: arasaacEnabled || pixabayEnabled,
    arasaacEnabled,
    pixabayEnabled,
    pixabayApiKey,
    storagePath: path.resolve(
      env.VOCABULARY_MEDIA_STORAGE_PATH?.trim() ||
        path.join(process.cwd(), "data", "vocabulary-media"),
    ),
    cacheTtlMs: integer(env, "VOCABULARY_IMAGE_CACHE_TTL_MS", 86_400_000, 86_400_000, 604_800_000),
    timeoutMs: integer(env, "VOCABULARY_IMAGE_TIMEOUT_MS", 15_000, 500, 30_000),
    maxBytes: integer(env, "VOCABULARY_IMAGE_MAX_BYTES", 5 * 1024 * 1024, 1024, 10 * 1024 * 1024),
    maxRedirects: integer(env, "VOCABULARY_IMAGE_MAX_REDIRECTS", 2, 0, 5),
    minDimension: 256,
    maxDimension: 4096,
    maxPixels: 16_000_000,
  };
}
