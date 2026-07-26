import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { config } from "../config/config";
import { pool } from "../db/pool";
import { AuditRepository } from "../repositories/audit.repository";
import { VocabularyRepository } from "../repositories/vocabulary.repository";
import { VocabularyService } from "./vocabulary.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "vocabulary_items",
      "vocabulary_sets",
      "vocabulary_media",
      "audit_logs",
      "users",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

async function actor(): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20a','v20a@example.com','hash','V20A')`,
  );
  return result.insertId;
}

const item = {
  displayOrder: 1,
  word: "Cat",
  meaningVi: "con mèo",
  tier: "CUSTOM" as const,
  illustration: { kind: "EMOJI" as const, value: "🐱" },
  supportsImageGame: true,
};

integration("migration seeds 20 deterministic topics with ordered CORE words", async () => {
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT t.id,t.slug,
      SUM(w.tier='CORE') core_count,
      MIN(CASE WHEN w.tier='CORE' THEN w.core_priority END) first_core,
      COUNT(DISTINCT CASE WHEN w.tier='CORE' THEN w.core_priority END) core_priorities
     FROM vocabulary_topics t
     LEFT JOIN vocabulary_topic_words w ON w.topic_id=t.id
     GROUP BY t.id ORDER BY t.display_order`,
  );
  assert.equal(topics.length, 20);
  assert.ok(topics.every((row) => Number(row.core_count) > 0));
  assert.ok(topics.every((row) => Number(row.first_core) === 1));
  assert.ok(topics.every((row) => Number(row.core_priorities) === Number(row.core_count)));
  const [migration] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0016_v20a_vocabulary_foundation.sql'",
  );
  assert.equal(migration.length, 1);
});

integration("topic age filter and suggestion keep CORE before EXTENDED", async () => {
  const service = new VocabularyService(new VocabularyRepository());
  const page = await service.listTopics({
    ageBand: "G6_G9",
    page: 1,
    pageSize: 50,
  });
  assert.ok(page.items.some((topicItem) => topicItem.slug === "daily-routines"));
  assert.ok(page.items.some((topicItem) => topicItem.slug === "colors"));
  assert.ok(page.items.every((topicItem) => topicItem.coreWordCount > 0));
  const colors = await service.suggest({
    topicSlug: "colors",
    ageBand: "G4_G5",
    targetCount: 12,
  });
  assert.ok(colors.items.some((word) => word.tier === "CORE"));
  assert.ok(colors.items.filter((word) => word.tier === "CORE").every((word) => word.selected));
  assert.ok(colors.items.slice(0, colors.topic.coreWordCount).every((word) => word.tier === "CORE"));
  const family = await service.suggest({
    topicSlug: "family",
    ageBand: "G6_G9",
    targetCount: 10,
  });
  assert.ok(family.items.some((word) => word.tier === "CORE"));
  const preschoolColors = await service.suggest({
    topicSlug: "colors",
    ageBand: "PRESCHOOL_G1",
    targetCount: 12,
  });
  assert.notDeepEqual(
    colors.items.filter((word) => word.tier === "EXTENDED").map((word) => word.id),
    preschoolColors.items.filter((word) => word.tier === "EXTENDED").map((word) => word.id),
  );
});

integration("set create/update/duplicate/archive/import persist atomically with audit", async () => {
  await clean();
  const actorId = await actor();
  const service = new VocabularyService(new VocabularyRepository());
  const id = await service.create({
    title: "Thú cưng",
    sourceType: "MANUAL",
    ageBand: "PRESCHOOL_G1",
    items: [item],
  }, actorId);
  await service.update(id, {
    title: "Thú cưng đã sửa",
    ageBand: "PRESCHOOL_G1",
    items: [
      { ...(await service.setDetail(id, actorId)).items[0], meaningVi: "mèo" },
      {
        ...item,
        displayOrder: 2,
        word: "Dog",
        meaningVi: "con chó",
        illustration: { kind: "NONE" },
        supportsImageGame: false,
      },
    ],
  }, actorId);
  assert.equal((await service.setDetail(id, actorId)).items.length, 2);
  const copyId = await service.duplicate(id, {}, actorId);
  assert.equal((await service.setDetail(copyId, actorId)).status, "ACTIVE");
  await service.archive(id, actorId);
  assert.equal((await service.setDetail(id, actorId)).status, "ARCHIVED");
  const importedId = await service.importPublicUnit({
    unitId: "preschool-happy-animals",
    levelSlug: "mam-non",
    contentVersion: 1,
    title: "Con vật đáng yêu",
    ageBand: "PRESCHOOL_G1",
    items: [{
      id: "pa-1",
      word: "cat",
      meaningVi: "con mèo",
      illustration: { kind: "PUBLIC_ASSET", value: "/learning/animals/cat.svg" },
    }],
  }, actorId);
  assert.deepEqual(
    (await service.setDetail(importedId, actorId)).sourceReference,
    {
      unitId: "preschool-happy-animals",
      levelSlug: "mam-non",
      contentVersion: 1,
    },
  );
  const [audits] = await pool.query<RowDataPacket[]>(
    `SELECT action FROM audit_logs WHERE entity_type='VOCABULARY_SET'`,
  );
  for (const action of [
    "VOCABULARY_SET_CREATED",
    "VOCABULARY_SET_UPDATED",
    "VOCABULARY_SET_DUPLICATED",
    "VOCABULARY_SET_ARCHIVED",
    "VOCABULARY_PUBLIC_UNIT_IMPORTED",
  ]) assert.ok(audits.some((row) => row.action === action), action);
});

integration("empty set list is valid and teacher ownership stays isolated", async () => {
  await clean();
  const ownerId = await actor();
  const [other] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20a-other','v20a-other@example.com','hash','Teacher khác')`,
  );
  const service = new VocabularyService(new VocabularyRepository());
  const empty = await service.listSets(ownerId, { page: 1, pageSize: 50 });
  assert.deepEqual(empty.items, []);
  assert.equal(empty.total, 0);

  const setId = await service.create({
    title: "Bộ từ của cô Vy",
    sourceType: "MANUAL",
    ageBand: "G2_G3",
    items: [item],
  }, ownerId);
  const ownSets = await service.listSets(ownerId, { page: 1, pageSize: 50 });
  const otherSets = await service.listSets(other.insertId, { page: 1, pageSize: 50 });
  assert.equal(ownSets.items[0]?.id, setId);
  assert.deepEqual(otherSets.items, []);
  await assert.rejects(
    service.setDetail(setId, other.insertId),
    (error: unknown) => (error as { code?: string }).code === "VOCABULARY_SET_NOT_FOUND",
  );
  await assert.rejects(
    service.update(setId, {
      title: "Không được sửa",
      ageBand: "G2_G3",
      items: [item],
    }, other.insertId),
    (error: unknown) => (error as { code?: string }).code === "VOCABULARY_SET_NOT_FOUND",
  );
  await assert.rejects(
    service.duplicate(setId, {}, other.insertId),
    (error: unknown) => (error as { code?: string }).code === "VOCABULARY_SET_NOT_FOUND",
  );
});

integration("invalid item and audit failure leave no partial vocabulary set", async () => {
  await clean();
  const actorId = await actor();
  const service = new VocabularyService(new VocabularyRepository());
  await assert.rejects(() => service.create({
    title: "Không hợp lệ",
    sourceType: "MANUAL",
    ageBand: "PRESCHOOL_G1",
    items: [item, { ...item, displayOrder: 2, word: "ＣＡＴ" }],
  }, actorId));
  class FailingAudit extends AuditRepository {
    override async record(_connection: PoolConnection): Promise<void> {
      throw new Error("audit failure");
    }
  }
  const failing = new VocabularyService(
    new VocabularyRepository(new FailingAudit()),
  );
  await assert.rejects(() => failing.create({
    title: "Phải rollback",
    sourceType: "MANUAL",
    ageBand: "PRESCHOOL_G1",
    items: [item],
  }, actorId));
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM vocabulary_sets WHERE title IN ('Không hợp lệ','Phải rollback')",
  );
  assert.equal(rows.length, 0);
});

integration("V20A HTTP routes are protected and never accept teacherUserId", async () => {
  await clean();
  const actorId = await actor();
  const server = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/api/vocabulary/topics`)).status, 401);
    const token = jwt.sign({
      id: actorId,
      username: "v20a",
      displayName: "V20A",
      role: "TEACHER",
    }, config.jwt.secret, { expiresIn: "5m" });
    const response = await fetch(`${base}/api/vocabulary/sets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacherUserId: 999999,
        title: "HTTP set",
        sourceType: "MANUAL",
        ageBand: "G2_G3",
        items: [{ ...item, illustration: { kind: "NONE" } }],
      }),
    });
    assert.equal(response.status, 201);
    const payload = await response.json() as { data: { id: number } };
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT teacher_user_id FROM vocabulary_sets WHERE id=?",
      [payload.data.id],
    );
    assert.equal(Number(rows[0].teacher_user_id), actorId);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});

test.after(async () => { if (enabled) await pool.end(); });
