import { createApp } from "./app";
import { config } from "./config/config";
import { pool } from "./db/pool";
import { googleSheetSyncWorker, vocabularyMediaService } from "./container";

async function start(): Promise<void> {
  await pool.query("SELECT 1");
  await vocabularyMediaService.initialize();
  const server = createApp().listen(config.port, () =>
    console.log(JSON.stringify({ level: "info", event: "server_started", port: config.port, environment: config.nodeEnv })),
  );
  if (config.nodeEnv !== "test") googleSheetSyncWorker.start();
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: "info", event: "shutdown_started", signal }));
    server.close(async () => {
      await googleSheetSyncWorker.stop();
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void start().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", event: "startup_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  void pool.end().finally(() => process.exit(1));
});

process.on("unhandledRejection", () => {
  console.error(JSON.stringify({ level: "fatal", event: "unhandled_rejection" }));
  process.exit(1);
});
