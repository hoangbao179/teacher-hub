export type AppEnvironment = "development" | "test" | "production";

export interface AuthSettings {
  adminPasswordMinLength: number;
  loginRateLimitWindowSeconds: number;
  loginRateLimitMaxFailures: number;
}

function optionalInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name]?.trim();
  const parsed = Number(raw || fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

export function resolveAuthSettings(
  env: NodeJS.ProcessEnv,
  nodeEnv: AppEnvironment,
): AuthSettings {
  const production = nodeEnv === "production";
  return {
    adminPasswordMinLength: optionalInteger(env, "ADMIN_PASSWORD_MIN_LENGTH", 6, 6, 128),
    loginRateLimitWindowSeconds: optionalInteger(
      env,
      "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
      production ? 300 : 60,
      1,
      86_400,
    ),
    loginRateLimitMaxFailures: optionalInteger(
      env,
      "LOGIN_RATE_LIMIT_MAX_FAILURES",
      production ? 10 : 20,
      1,
      1_000,
    ),
  };
}
