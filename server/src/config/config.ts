import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  db: {
    host: required("DB_HOST", "127.0.0.1"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER", "teacher_app"),
    password: required("DB_PASSWORD", "teacher_app"),
    database: required("DB_NAME", "teacher_class_hub"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
  },
  jwt: {
    secret: required(
      "JWT_SECRET",
      "development-only-secret-change-before-production",
    ),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
};
