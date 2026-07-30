export interface GoogleDriveSettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  rootFolderId: string;
  ownerLabel: string;
  templateVersion: string;
}

const GOOGLE_DRIVE_OWNER_LABEL = "Cô Vy";
const GOOGLE_SHEETS_TEMPLATE_VERSION = "v5";

function text(env: NodeJS.ProcessEnv, name: string): string {
  return env[name]?.trim() ?? "";
}

export function resolveGoogleDriveSettings(env: NodeJS.ProcessEnv): GoogleDriveSettings {
  const rawEnabled = text(env, "GOOGLE_DRIVE_ENABLED") || "false";
  if (!/^(true|false)$/i.test(rawEnabled)) throw new Error("GOOGLE_DRIVE_ENABLED must be true or false");
  const enabled = rawEnabled.toLowerCase() === "true";
  const settings = {
    enabled,
    clientId: text(env, "GOOGLE_DRIVE_CLIENT_ID"),
    clientSecret: text(env, "GOOGLE_DRIVE_CLIENT_SECRET"),
    refreshToken: text(env, "GOOGLE_DRIVE_REFRESH_TOKEN"),
    rootFolderId: text(env, "GOOGLE_DRIVE_ROOT_FOLDER_ID"),
    ownerLabel: GOOGLE_DRIVE_OWNER_LABEL,
    templateVersion: GOOGLE_SHEETS_TEMPLATE_VERSION,
  };
  if (enabled) {
    for (const [field, value] of Object.entries({
      GOOGLE_DRIVE_CLIENT_ID: settings.clientId,
      GOOGLE_DRIVE_CLIENT_SECRET: settings.clientSecret,
      GOOGLE_DRIVE_REFRESH_TOKEN: settings.refreshToken,
      GOOGLE_DRIVE_ROOT_FOLDER_ID: settings.rootFolderId,
    })) if (!value) throw new Error(`Missing required environment variable: ${field}`);
  }
  return settings;
}

export function redactGoogleError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? "Unknown Google error");
  return message
    .replace(/(access_token|refresh_token|client_secret|authorization)\s*[=:]\s*[^\s,;}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]");
}
