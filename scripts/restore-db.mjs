/* global process, console */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sourceArg = process.argv[2];
const confirmed = process.argv.includes("--confirm");
if (!sourceArg || sourceArg === "--help" || !confirmed) {
  console.log("Usage: npm run db:restore -- <backup.sql> --confirm (overwrites rows in the selected database)");
  process.exit(sourceArg === "--help" ? 0 : 1);
}
const source = path.resolve(sourceArg);
if (!fs.existsSync(source) || !source.endsWith(".sql")) { console.error("Restore source must be an existing .sql file."); process.exit(1); }
const args = ["-h", process.env.DB_HOST ?? "127.0.0.1", "-P", process.env.DB_PORT ?? "3306",
  "-u", process.env.DB_USER ?? "teacher_app", process.env.DB_NAME ?? "teacher_class_hub"];
const result = spawnSync("mysql", args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD ?? "" }, input: fs.readFileSync(source), stdio: ["pipe", "inherit", "inherit"] });
if (result.status !== 0) { console.error("Database restore failed; target data may be partial. Stop and inspect before retrying."); process.exit(result.status ?? 1); }
console.log("Restore completed. Run migrations and post-restore verification now.");
