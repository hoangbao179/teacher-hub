export type AppEnvironment = "development" | "test" | "production";

export interface AuthSettings {
  adminPasswordMinLength: number;
  loginRateLimitWindowSeconds: number;
  loginRateLimitMaxFailures: number;
}

export function resolveAuthSettings(nodeEnv: AppEnvironment): AuthSettings {
  return {
    adminPasswordMinLength: 6,
    loginRateLimitWindowSeconds: nodeEnv === "production" ? 300 : nodeEnv === "test" ? 3 : 60,
    loginRateLimitMaxFailures: nodeEnv === "production" ? 10 : nodeEnv === "test" ? 2 : 20,
  };
}
