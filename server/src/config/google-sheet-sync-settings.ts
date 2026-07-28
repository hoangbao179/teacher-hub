export interface GoogleSheetSyncSettings {
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  maxAttempts: number;
  lockTimeoutMs: number;
}

const GOOGLE_SHEET_SYNC_INTERVAL_MS = 30_000;
const GOOGLE_SHEET_SYNC_BATCH_SIZE = 20;
const GOOGLE_SHEET_SYNC_MAX_ATTEMPTS = 8;
const GOOGLE_SHEET_SYNC_LOCK_TIMEOUT_MS = 600_000;

export function resolveGoogleSheetSyncSettings(env: NodeJS.ProcessEnv): GoogleSheetSyncSettings {
  const rawEnabled = env.GOOGLE_SHEET_SYNC_ENABLED?.trim() || "false";
  if (!/^(true|false)$/i.test(rawEnabled)) throw new Error("GOOGLE_SHEET_SYNC_ENABLED must be true or false");
  return {
    enabled: rawEnabled.toLowerCase() === "true",
    intervalMs: GOOGLE_SHEET_SYNC_INTERVAL_MS,
    batchSize: GOOGLE_SHEET_SYNC_BATCH_SIZE,
    maxAttempts: GOOGLE_SHEET_SYNC_MAX_ATTEMPTS,
    lockTimeoutMs: GOOGLE_SHEET_SYNC_LOCK_TIMEOUT_MS,
  };
}
