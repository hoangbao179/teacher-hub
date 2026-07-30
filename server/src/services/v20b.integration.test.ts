import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createApp } from "../app";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { VocabularyMediaRepository } from "../repositories/vocabulary-media.repository";
import { VocabularyRepository } from "../repositories/vocabulary.repository";
import { AssignmentRepository } from "../repositories/assignment.repository";
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

integration("ARASAAC search-import-save persists one audited active media without extra files", async () => {
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0017_v20b_vocabulary_media_editor.sql'",
  );
  assert.equal(migration.length, 1);

  await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query='apple' AND provider='ARASAAC'");
  await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query LIKE 'old-cache-%' AND provider='ARASAAC'");
  await pool.query("DELETE FROM vocabulary_media WHERE provider='ARASAAC' AND provider_asset_id IN ('900000042','900000043','900000044')");
  await pool.query("DELETE a FROM audit_logs a JOIN users u ON u.id=a.actor_user_id WHERE u.username='v20b'");
  await pool.query("DELETE FROM users WHERE username='v20b'");
  const [actor] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20b','v20b@example.com','hash','V20B')`,
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "v20b-media-"));
  let setId: number | undefined;
  let assignmentId: number | undefined;
  try {
    let resolvedAssets = 0;
    const oldAsset = {
      provider: "ARASAAC" as const,
      providerAssetId: "900000044",
      previewUrl: "https://static.arasaac.org/pictograms/900000044/900000044_300.png",
      thumbnailUrl: "https://static.arasaac.org/pictograms/900000044/900000044_300.png",
      downloadUrl: "https://static.arasaac.org/pictograms/900000044/900000044_500.png",
      width: 500,
      height: 500,
      mediaType: "ILLUSTRATION" as const,
      tags: ["old cache"],
      contributorName: "Sergio Palao / ARASAAC",
      contributorUrl: "https://arasaac.org",
      attributionText: "Pictogram của Sergio Palao, nguồn ARASAAC, thuộc Government of Aragón",
      sourcePageUrl: "https://arasaac.org/pictograms/en/900000044",
      licenseLabel: "CC BY-NC-SA",
    };
    const provider = {
      name: "ARASAAC" as const,
      allowedDownloadHosts: ["static.arasaac.org"] as const,
      supportedMediaTypes: ["ALL", "ILLUSTRATION"] as const,
      calls: [] as unknown[],
      search(input: unknown) {
        this.calls.push(input);
        return Promise.resolve({
      total: 1,
      items: [{
        provider: "ARASAAC" as const,
        providerAssetId: "900000042",
        previewUrl: "https://static.arasaac.org/pictograms/900000042/900000042_300.png",
        thumbnailUrl: "https://static.arasaac.org/pictograms/900000042/900000042_300.png",
        downloadUrl: "https://static.arasaac.org/pictograms/900000042/900000042_500.png",
        width: 500,
        height: 500,
        mediaType: "ILLUSTRATION" as const,
        tags: ["apple"],
        contributorName: "Sergio Palao / ARASAAC",
        contributorUrl: "https://arasaac.org",
        attributionText: "Pictogram của Sergio Palao, nguồn ARASAAC, thuộc Government of Aragón",
        sourcePageUrl: "https://arasaac.org/pictograms/en/900000042",
        licenseLabel: "CC BY-NC-SA",
      }],
        });
      },
      resolveAsset(providerAssetId: string) {
        resolvedAssets += 1;
        return Promise.resolve(providerAssetId === oldAsset.providerAssetId ? oldAsset : null);
      },
    };
    const downloader = {
      download: async (url: string, _hosts: readonly string[], fit: string) => {
        assert.equal(fit, "contain");
        return ({
        game: Buffer.from("game rendition"),
        thumbnail: Buffer.from("thumbnail rendition"),
        width: 500,
        height: 500,
        byteSize: 14,
        contentSha256: url.includes(oldAsset.providerAssetId) ? "c".repeat(64) : "b".repeat(64),
        });
      },
    };
    const service = new VocabularyMediaService(
      new VocabularyMediaRepository(),
      provider,
      {
        enabled: true,
        arasaacEnabled: true,
        pixabayEnabled: false,
        pixabayApiKey: "",
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
    const searched = await service.search({ query: "apple", mediaType: "ILLUSTRATION" });
    assert.equal(searched.items.length, 1);
    assert.equal(searched.provider, "ARASAAC");
    await service.search({ query: " APPLE ", mediaType: "ILLUSTRATION" });
    assert.equal(provider.calls.length, 1);

    const importRequest = {
      provider: "ARASAAC" as const,
      providerAssetId: "900000042",
      altText: "quả táo",
    };
    const [media, simultaneous] = await Promise.all([
      service.importMedia(importRequest, actor.insertId),
      service.importMedia(importRequest, actor.insertId),
    ]);
    assert.equal(simultaneous.id, media.id);
    const replay = await service.importMedia({
      provider: "ARASAAC",
      providerAssetId: "900000042",
      altText: "quả táo",
    }, actor.insertId);
    assert.equal(replay.id, media.id);
    assert.equal((await service.mediaFile(media.id, "THUMBNAIL")).media.id, media.id);
    assert.equal(await fs.readFile((await service.mediaFile(media.id, "GAME")).path, "utf8"), "game rendition");
    assert.equal((await fs.readdir(path.join(root, "game"))).length, 1);
    assert.equal((await fs.readdir(path.join(root, "thumbnail"))).length, 1);

    for (let index = 0; index <= 100; index += 1) {
      const payload = { total: index === 0 ? 1 : 0, items: index === 0 ? [oldAsset] : [] };
      await pool.execute(
        `INSERT INTO vocabulary_image_search_cache
          (provider,cache_key,normalized_query,media_type,orientation,page,page_size,
           result_json,expires_at,created_at)
         VALUES ('ARASAAC',?,?,?,?,?,?,?,?,?)`,
        [
          `${"f".repeat(61)}${String(index).padStart(3, "0")}`,
          `old-cache-${index}`,
          "ILLUSTRATION",
          "ALL",
          1,
          8,
          JSON.stringify(payload),
          new Date("2027-07-30T00:00:00Z"),
          new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        ],
      );
    }
    const resolvedOld = await service.importMedia({
      provider: "ARASAAC",
      providerAssetId: oldAsset.providerAssetId,
      altText: "old cache asset",
    }, actor.insertId);
    assert.equal(resolvedOld.providerAssetId, oldAsset.providerAssetId);
    assert.equal(resolvedAssets, 1);
    assert.equal((await fs.readdir(path.join(root, "game"))).length, 2);
    assert.equal((await fs.readdir(path.join(root, "thumbnail"))).length, 2);

    const vocabulary = new VocabularyRepository();
    setId = await vocabulary.create({
      title: "ARASAAC integration",
      description: null,
      sourceType: "MANUAL",
      sourceReference: null,
      ageBand: "G2_G3",
      items: [{
        displayOrder: 1, word: "apple", normalizedWord: "apple",
        meaningVi: "quả táo", normalizedMeaning: "quả táo",
        phonetic: null, partOfSpeech: null, exampleEn: null, speechText: "apple",
        tier: "CUSTOM", illustrationKind: "STORED_MEDIA", illustrationValue: null,
        mediaId: media.id, supportsImageGame: true, imageSearchTerms: ["apple"],
      }, {
        displayOrder: 2, word: "green apple", normalizedWord: "green apple",
        meaningVi: "táo xanh", normalizedMeaning: "táo xanh",
        phonetic: null, partOfSpeech: null, exampleEn: null, speechText: "green apple",
        tier: "CUSTOM", illustrationKind: "STORED_MEDIA", illustrationValue: null,
        mediaId: media.id, supportsImageGame: true, imageSearchTerms: ["green apple"],
      }],
    }, actor.insertId);
    const [promoted] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM vocabulary_media WHERE id=?",
      [media.id],
    );
    assert.equal(promoted[0].status, "ACTIVE");
    const [setItems] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM vocabulary_items
       WHERE vocabulary_set_id=? AND status='ACTIVE' ORDER BY display_order`,
      [setId],
    );
    assignmentId = await new AssignmentRepository().create({
      title: "ARASAAC assignment",
      vocabularySetId: setId,
      ageBand: "G2_G3",
      audienceType: "OPEN_LINK",
      templateCode: "CUSTOM",
      answerFeedbackMode: "IMMEDIATE",
      shuffleQuestions: false,
      items: [{
        sourceVocabularyItemId: Number(setItems[0].id),
        displayOrder: 1,
        word: "apple",
        meaningVi: "quả táo",
        speechText: "apple",
        tier: "CUSTOM",
        illustration: { kind: "STORED_MEDIA", mediaId: media.id },
        supportsImageGame: true,
        imageSearchTerms: ["apple"],
      }, {
        sourceVocabularyItemId: Number(setItems[1].id),
        displayOrder: 2,
        word: "green apple",
        meaningVi: "táo xanh",
        speechText: "green apple",
        tier: "CUSTOM",
        illustration: { kind: "STORED_MEDIA", mediaId: media.id },
        supportsImageGame: true,
        imageSearchTerms: ["green apple"],
      }],
      activities: [{
        displayOrder: 1,
        mechanic: "EXPLORE_CARD",
        presentation: "FLASHCARD",
        required: true,
      }],
    }, actor.insertId);
    const [assignmentMedia] = await pool.query<RowDataPacket[]>(
      "SELECT stored_media_id FROM learning_assignment_items WHERE assignment_id=?",
      [assignmentId],
    );
    assert.equal(Number(assignmentMedia[0].stored_media_id), media.id);
    const assignments = new AssignmentRepository();
    await assignments.publish({
      id: assignmentId,
      teacherUserId: actor.insertId,
      expectedVersion: 1,
      publicCode: "ARAS42T1",
      createToken: (studentId) => ({
        studentId,
        rawToken: "unused",
        tokenHash: "d".repeat(64),
      }),
      openToken: { rawToken: "open-token", tokenHash: "e".repeat(64) },
    });
    const publicAssignment = await assignments.publicDetail("ARAS42T1");
    assert.equal(publicAssignment?.items.length, 2);
    for (const item of publicAssignment?.items ?? []) {
      assert.equal(item.illustrationSnapshot.kind, "STORED_MEDIA");
      assert.equal(item.illustrationSnapshot.mediaId, media.id);
      assert.equal(item.illustrationSnapshot.mediaUrl,
        `/api/public/vocabulary-media/${media.id}?variant=GAME`);
      assert.equal(item.illustrationSnapshot.thumbnailUrl,
        `/api/public/vocabulary-media/${media.id}?variant=THUMBNAIL`);
    }

    const [failed] = await pool.execute<ResultSetHeader>(
      `INSERT INTO vocabulary_media(provider,provider_asset_id,alt_text,status)
       VALUES ('ARASAAC','900000043','failed','FAILED')`,
    );
    const invalidInput = {
      title: "Invalid media", description: null, sourceType: "MANUAL" as const,
      sourceReference: null, ageBand: "G2_G3" as const,
      items: [{
        displayOrder: 1, word: "bad", normalizedWord: "bad",
        meaningVi: "lỗi", normalizedMeaning: "lỗi", phonetic: null,
        partOfSpeech: null, exampleEn: null, speechText: "bad", tier: "CUSTOM" as const,
        illustrationKind: "STORED_MEDIA" as const, illustrationValue: null,
        mediaId: failed.insertId, supportsImageGame: true, imageSearchTerms: ["bad"],
      }],
    };
    await assert.rejects(
      vocabulary.create(invalidInput, actor.insertId),
      (error: unknown) => error instanceof AppError &&
        error.code === "VOCABULARY_MEDIA_NOT_FOUND" && error.statusCode === 422,
    );
    invalidInput.items[0].mediaId = 999_999_999;
    await assert.rejects(
      vocabulary.create(invalidInput, actor.insertId),
      (error: unknown) => error instanceof AppError && error.code === "VOCABULARY_MEDIA_NOT_FOUND",
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id,
        (SELECT COUNT(*) FROM audit_logs a
          WHERE a.entity_type='VOCABULARY_MEDIA' AND a.entity_id=m.id) audit_count
       FROM vocabulary_media m WHERE m.provider='ARASAAC' AND m.provider_asset_id='900000042'`,
    );
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].audit_count), 1);
  } finally {
    if (assignmentId) await pool.query("DELETE FROM learning_assignments WHERE id=?", [assignmentId]);
    if (setId) {
      await pool.query("DELETE FROM vocabulary_items WHERE vocabulary_set_id=?", [setId]);
      await pool.query("DELETE FROM vocabulary_sets WHERE id=?", [setId]);
    }
    await pool.query("DELETE FROM vocabulary_media WHERE provider='ARASAAC' AND provider_asset_id IN ('900000042','900000043','900000044')");
    await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query LIKE 'old-cache-%' AND provider='ARASAAC'");
    await pool.query("DELETE FROM vocabulary_image_search_cache WHERE normalized_query='apple' AND provider='ARASAAC'");
    await pool.query("DELETE FROM audit_logs WHERE actor_user_id=?", [actor.insertId]);
    await pool.query("DELETE FROM users WHERE username='v20b'");
    await fs.rm(root, { recursive: true, force: true });
  }
});
