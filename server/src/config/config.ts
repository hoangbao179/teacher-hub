import "dotenv/config";
import { resolveAuthSettings, type AppEnvironment } from "./auth-settings";

const nodeEnv = process.env.NODE_ENV ?? "development";
if (!["development", "test", "production"].includes(nodeEnv)) throw new Error("NODE_ENV must be development, test or production");
const production = nodeEnv === "production";
const authSettings = resolveAuthSettings(nodeEnv as AppEnvironment);
const timezone = "Asia/Ho_Chi_Minh";
process.env.TZ = timezone;

function value(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}
function integer(name: string, fallback: number, min: number, max: number): number {
  const result = Number(value(name, String(fallback)));
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return result;
}

const jwtSecret = value("JWT_SECRET", "development-only-secret-change-before-production");
if (production && (jwtSecret.length < 32 || /change|default|development|replace|secret/i.test(jwtSecret)))
  throw new Error("JWT_SECRET must be a strong random production secret of at least 32 characters");
const corsOrigin = production ? "https://tienganhcovy.com" : value("CORS_ORIGIN", "http://localhost:5173");
for (const origin of corsOrigin.split(",").map((item) => item.trim())) {
  const url = new URL(origin);
  if (!/^https?:$/.test(url.protocol) || (production && url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("CORS_ORIGIN must contain valid HTTPS origins in production");
}
const dbPassword = value("DB_PASSWORD", "teacher_app");
if (production && !process.env.DB_PASSWORD?.trim()) throw new Error("Missing required environment variable: DB_PASSWORD");

export const config = {
  nodeEnv,
  port: integer("PORT", 4000, 1, 65535),
  timezone,
  corsOrigin,
  db: {
    host: value("DB_HOST", production ? "mysql" : "127.0.0.1"),
    port: integer("DB_PORT", 3306, 1, 65535),
    user: value("DB_USER", "teacher_app"),
    password: dbPassword,
    database: value("DB_NAME", "teacher_class_hub"),
    connectionLimit: 5,
  },
  jwt: { secret: jwtSecret, expiresIn: "7d" },
  auth: authSettings,
};
