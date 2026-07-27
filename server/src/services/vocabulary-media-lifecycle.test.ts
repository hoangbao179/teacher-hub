import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { VocabularyMediaSettings } from "../config/vocabulary-media-settings";
import type { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { VocabularyMediaService } from "./vocabulary-media.service";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";

test("orphan cleanup removes both renditions but never removes a newly referenced media row", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "media-lifecycle-"));
  try {
    const storage = new VocabularyMediaStorage(root);
    const files = await storage.write(Buffer.from("game"), Buffer.from("thumb"));
    let referenced = true;
    const repository = {
      temporaryOrphans: async () => [{ id: 7, storagePath: files.storagePath, thumbnailPath: files.thumbnailPath }],
      deleteUnreferenced: async () => !referenced,
    } as unknown as VocabularyMediaRepository;
    const settings = { enabled: false, apiKey: "", storagePath: root, cacheTtlMs: 86_400_000,
      timeoutMs: 15_000, maxBytes: 5 * 1024 * 1024, maxRedirects: 2,
      minDimension: 256, maxDimension: 4096, maxPixels: 16_000_000 } satisfies VocabularyMediaSettings;
    const service = new VocabularyMediaService(repository, null, settings, undefined, storage);
    assert.equal(await service.cleanupOrphans(0), 0);
    assert.equal(await storage.exists(files.storagePath), true);
    referenced = false;
    assert.equal(await service.cleanupOrphans(0), 1);
    assert.equal(await storage.exists(files.storagePath), false);
    assert.equal(await storage.exists(files.thumbnailPath), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
