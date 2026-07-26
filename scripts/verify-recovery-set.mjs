/* global process, console */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const sourceArg = process.argv[2];
if (!sourceArg || sourceArg === "--help") {
  console.log("Usage: npm run verify:recovery-set -- <recovery-set-directory>");
  process.exit(sourceArg ? 0 : 1);
}
const root = path.resolve(sourceArg);
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
if (manifest.formatVersion !== 1 || manifest.mediaVolume !== "vocabulary-media")
  throw new Error("Unsupported recovery-set manifest");
for (const [name, expected] of Object.entries(manifest.artifacts)) {
  if (!["database.sql", "vocabulary-media.tar"].includes(name))
    throw new Error("Unexpected artifact path");
  const file = path.join(root, name);
  const data = await fs.readFile(file);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (sha256 !== expected.sha256 || data.byteLength !== expected.bytes)
    throw new Error(`Checksum mismatch: ${name}`);
}
console.log("Recovery-set manifest and checksums PASS");
