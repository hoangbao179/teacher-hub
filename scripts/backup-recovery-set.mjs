/* global process, console */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const destinationArg = process.argv[2];
if (!destinationArg || destinationArg === "--help") {
  console.log("Usage: npm run backup:recovery-set -- <new-output-directory>");
  process.exit(destinationArg ? 0 : 1);
}
const destination = path.resolve(destinationArg);
const mediaRoot = path.resolve(process.env.VOCABULARY_MEDIA_STORAGE_PATH ?? "./data/vocabulary-media");
if (fs.existsSync(destination)) {
  console.error("Recovery-set destination must not already exist.");
  process.exit(1);
}
await fsp.mkdir(destination, { recursive: true });
await fsp.mkdir(mediaRoot, { recursive: true });
const lockPath = path.join(mediaRoot, ".backup.lock");
let lock;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { ...options, stdio: options.stdio ?? "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed`);
}
async function checksum(file) {
  return createHash("sha256").update(await fsp.readFile(file)).digest("hex");
}

try {
  lock = await fsp.open(lockPath, "wx");
  await lock.writeFile(`${JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid })}\n`);
  const sql = path.join(destination, "database.sql");
  const media = path.join(destination, "vocabulary-media.tar");
  const dumpArgs = [
    "--single-transaction", "--routines", "--triggers", "--set-gtid-purged=OFF",
    "-h", process.env.DB_HOST ?? "127.0.0.1", "-P", process.env.DB_PORT ?? "3306",
    "-u", process.env.DB_USER ?? "teacher_app", process.env.DB_NAME ?? "teacher_class_hub",
  ];
  const dump = spawnSync("mysqldump", dumpArgs, {
    env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD ?? "" },
    encoding: "buffer",
  });
  if (dump.status !== 0) throw new Error("mysqldump failed");
  await fsp.writeFile(sql, dump.stdout);
  run("tar", ["-cf", media, "--exclude=.backup.lock", "-C", mediaRoot, "."]);
  const migration = spawnSync(
    "mysql",
    [
      "-N", "-B", "-h", process.env.DB_HOST ?? "127.0.0.1",
      "-P", process.env.DB_PORT ?? "3306", "-u", process.env.DB_USER ?? "teacher_app",
      process.env.DB_NAME ?? "teacher_class_hub",
      "-e", "SELECT COALESCE(MAX(version),'none') FROM schema_migrations",
    ],
    { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD ?? "" }, encoding: "utf8" },
  );
  if (migration.status !== 0) throw new Error("Cannot read schema migration");
  const artifacts = {};
  for (const file of [sql, media]) {
    const stat = await fsp.stat(file);
    artifacts[path.basename(file)] = { bytes: stat.size, sha256: await checksum(file) };
  }
  await fsp.writeFile(path.join(destination, "manifest.json"), `${JSON.stringify({
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    releaseSha: process.env.RELEASE_SHA?.trim() || "unknown",
    schemaMigration: migration.stdout.trim(),
    mediaVolume: "vocabulary-media",
    artifacts,
  }, null, 2)}\n`);
  console.log(`Recovery set written: ${destination}`);
} catch (error) {
  await fsp.writeFile(path.join(destination, "INCOMPLETE"), `${String(error)}\n`).catch(() => {});
  console.error("Recovery-set backup failed; destination is marked INCOMPLETE.");
  process.exitCode = 1;
} finally {
  await lock?.close().catch(() => {});
  await fsp.rm(lockPath, { force: true }).catch(() => {});
}
