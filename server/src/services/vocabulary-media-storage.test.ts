import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";

test("media storage writes inside its root and rejects path traversal", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vocabulary-media-"));
  try {
    const storage = new VocabularyMediaStorage(root);
    const files = await storage.write(Buffer.from("game"), Buffer.from("thumb"));
    assert.equal((await fs.readFile(files.absoluteStoragePath)).toString(), "game");
    assert.throws(() => storage.resolve("../secret.webp"), /Unsafe|traversal/);
    assert.throws(() => storage.resolve("game/../../secret.webp"), /Unsafe|traversal/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
