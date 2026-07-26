import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "vocabulary-media-recovery-"));
const source = path.join(temp, "source-volume");
const backup = path.join(temp, "backup", "vocabulary-media");
const restored = path.join(temp, "restored-volume");

async function sha(file) {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function manifest(directory) {
  const result = {};
  for (const variant of ["game", "thumbnail"]) {
    const variantDir = path.join(directory, variant);
    for (const entry of await fs.readdir(variantDir)) {
      const relative = `${variant}/${entry}`;
      result[relative] = await sha(path.join(directory, relative));
    }
  }
  return result;
}

try {
  await fs.mkdir(path.join(source, "game"), { recursive: true });
  await fs.mkdir(path.join(source, "thumbnail"), { recursive: true });
  await fs.writeFile(path.join(source, "game", "fixture.webp"), "game-rendition");
  await fs.writeFile(path.join(source, "thumbnail", "fixture.webp"), "thumbnail-rendition");

  await fs.cp(source, backup, { recursive: true, errorOnExist: true });
  const expected = await manifest(backup);
  await fs.writeFile(
    path.join(temp, "backup", "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), files: expected }, null, 2)}\n`,
  );
  await fs.cp(backup, restored, { recursive: true, errorOnExist: true });
  assert.deepEqual(await manifest(restored), expected);

  for (const composeFile of ["docker-compose.deploy.yml", "docker-compose.prod.yml"]) {
    const compose = await fs.readFile(path.join(root, composeFile), "utf8");
    assert.match(compose, /vocabulary-media:\/app\/data\/vocabulary-media/);
    assert.match(compose, /^  vocabulary-media:/m);
  }
  console.log("Vocabulary media backup/restore smoke PASS");
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
