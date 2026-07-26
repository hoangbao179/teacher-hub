import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createApp } from "../app";
import { pool } from "../db/pool";
import { FakeImageSearchProvider } from "../integrations/images/fake-image-search.provider";
import { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";
import { VocabularyMediaService } from "./vocabulary-media.service";

const integration = process.env.RUN_MYSQL_INTEGRATION === "1" ? test : test.skip;
test.after(async () => {
  if (process.env.RUN_MYSQL_INTEGRATION === "1") await pool.end();
});

integration("V20B search/status require auth while media read remains public", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const status = await fetch(`http://127.0.0.1:${port}/api/vocabulary/media/status`);
    const search = await fetch(`http://127.0.0.1:${port}/api/vocabulary/media/search?query=apple`);
    const media = await fetch(`http://127.0.0.1:${port}/api/public/vocabulary-media/999999`);
    assert.equal(status.status, 401);
    assert.equal(search.status, 401);
    assert.equal(media.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});

integration("V20B migration and search-cache-import-serve persist one audited media", async () => {
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0017_v20b_vocabulary_media_editor.sql'",
  );
  assert.equal(migration.length, 1);

  await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query='v20b apple'");
  await pool.query("DELETE FROM vocabulary_media WHERE provider_asset_id='v20b-asset'");
  await pool.query("DELETE a FROM audit_logs a JOIN users u ON u.id=a.actor_user_id WHERE u.username='v20b'");
  await pool.query("DELETE FROM users WHERE username='v20b'");
  const [actor] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20b','v20b@example.com','hash','V20B')`,
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "v20b-media-"));
  try {
    const provider = new FakeImageSearchProvider();
    provider.result = {
      total: 1,
      items: [{
        provider: "PIXABAY",
        providerAssetId: "v20b-asset",
        previewUrl: "https://images.test/preview.webp",
        thumbnailUrl: "https://images.test/thumb.webp",
        downloadUrl: "https://images.test/source.webp",
        width: 600,
        height: 400,
        mediaType: "PHOTO",
        contributorName: "V20B",
        contributorUrl: "https://images.test/contributor",
        attributionText: "V20B test image",
        sourcePageUrl: "https://images.test/source",
        licenseLabel: "Test license",
      }],
    };
    const downloader = {
      download: async () => ({
        game: Buffer.from("game rendition"),
        thumbnail: Buffer.from("thumbnail rendition"),
        width: 600,
        height: 400,
        byteSize: 14,
        contentSha256: "b".repeat(64),
      }),
    };
    const service = new VocabularyMediaService(
      new VocabularyMediaRepository(),
      provider,
      {
        enabled: true,
        apiKey: "fake",
        storagePath: root,
        cacheTtlMs: 86_400_000,
        timeoutMs: 5_000,
        maxBytes: 5 * 1024 * 1024,
        maxRedirects: 2,
        minDimension: 256,
        maxDimension: 4096,
        maxPixels: 16_000_000,
      },
      downloader as never,
      new VocabularyMediaStorage(root),
    );
    const searched = await service.search({ query: "V20B Apple" });
    assert.equal(searched.items.length, 1);
    await service.search({ query: " v20b   apple " });
    assert.equal(provider.calls.length, 1);

    const media = await service.importMedia({
      provider: "PIXABAY",
      providerAssetId: "v20b-asset",
      altText: "quả táo",
    }, actor.insertId);
    const replay = await service.importMedia({
      provider: "PIXABAY",
      providerAssetId: "v20b-asset",
      altText: "quả táo",
    }, actor.insertId);
    assert.equal(replay.id, media.id);
    assert.equal(await fs.readFile((await service.mediaFile(media.id, "GAME")).path, "utf8"), "game rendition");

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id,
        (SELECT COUNT(*) FROM audit_logs a
          WHERE a.entity_type='VOCABULARY_MEDIA' AND a.entity_id=m.id) audit_count
       FROM vocabulary_media m WHERE m.provider_asset_id='v20b-asset'`,
    );
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].audit_count), 1);
  } finally {
    await pool.query("DELETE FROM vocabulary_media WHERE provider_asset_id='v20b-asset'");
    await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query='v20b apple'");
    await pool.query("DELETE FROM audit_logs WHERE actor_user_id=?", [actor.insertId]);
    await pool.query("DELETE FROM users WHERE username='v20b'");
    await fs.rm(root, { recursive: true, force: true });
  }
});
