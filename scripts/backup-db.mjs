/* global process, console */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const destination = process.argv[2];
if (!destination || destination === "--help") {
  console.log("Usage: npm run db:backup -- <absolute-or-relative-output.sql>");
  process.exit(destination ? 0 : 1);
}
const output = path.resolve(destination);
fs.mkdirSync(path.dirname(output), { recursive: true });
const args = ["--single-transaction", "--routines", "--triggers", "--set-gtid-purged=OFF",
  "-h", process.env.DB_HOST ?? "127.0.0.1", "-P", process.env.DB_PORT ?? "3306",
  "-u", process.env.DB_USER ?? "teacher_app", process.env.DB_NAME ?? "teacher_class_hub"];
const result = spawnSync("mysqldump", args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD ?? "" }, encoding: "buffer" });
if (result.status !== 0) { console.error("Database backup failed; verify MySQL client and environment."); process.exit(result.status ?? 1); }
fs.writeFileSync(output, result.stdout);
console.log(`Backup written: ${output}`);
