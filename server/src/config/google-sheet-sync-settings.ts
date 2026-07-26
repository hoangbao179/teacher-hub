export interface GoogleSheetSyncSettings {
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  maxAttempts: number;
  lockTimeoutMs: number;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const value = Number(env[name]?.trim() || fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

export function resolveGoogleSheetSyncSettings(env: NodeJS.ProcessEnv): GoogleSheetSyncSettings {
  const rawEnabled = env.GOOGLE_SHEET_SYNC_ENABLED?.trim() || "false";
  if (!/^(true|false)$/i.test(rawEnabled)) throw new Error("GOOGLE_SHEET_SYNC_ENABLED must be true or false");
  return {
    enabled: rawEnabled.toLowerCase() === "true",
    intervalMs: integer(env, "GOOGLE_SHEET_SYNC_INTERVAL_MS", 30_000, 1_000, 3_600_000),
    batchSize: integer(env, "GOOGLE_SHEET_SYNC_BATCH_SIZE", 20, 1, 200),
    maxAttempts: integer(env, "GOOGLE_SHEET_SYNC_MAX_ATTEMPTS", 8, 1, 100),
    lockTimeoutMs: integer(env, "GOOGLE_SHEET_SYNC_LOCK_TIMEOUT_MS", 600_000, 10_000, 86_400_000),
  };
}
