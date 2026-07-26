import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

test.after(async () => { if (enabled) await pool.end(); });

integration("V20F migrations expose question-item analytics and vocabulary sheet outbox safely", async () => {
  const [migrations] = await pool.query<RowDataPacket[]>(
    `SELECT version FROM schema_migrations
     WHERE version IN (
       '0020_v20e_vocabulary_results.sql',
       '0021_v20f_vocabulary_stabilization.sql',
       '0022_v20f_question_item_fallback.sql'
     ) ORDER BY version`,
  );
  assert.deepEqual(migrations.map((row) => row.version), [
    "0020_v20e_vocabulary_results.sql",
    "0021_v20f_vocabulary_stabilization.sql",
    "0022_v20f_question_item_fallback.sql",
  ]);

  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME table_name,COLUMN_NAME column_name,DATA_TYPE data_type,
       IS_NULLABLE is_nullable,COLUMN_TYPE column_type
     FROM information_schema.columns
     WHERE table_schema=DATABASE() AND (
       (table_name='learning_attempt_questions'
         AND column_name IN ('question_kind','score_weight'))
       OR (table_name IN ('vocabulary_items','learning_assignment_items')
         AND column_name='image_search_terms_json')
       OR (table_name='google_sheet_sync_outbox'
         AND column_name IN ('lesson_id','entity_type','entity_id','event_type'))
     )`,
  );
  const column = (table: string, name: string) => columns.find(
    (row) => row.table_name === table && row.column_name === name,
  );
  assert.equal(column("learning_attempt_questions", "question_kind")?.data_type, "enum");
  assert.equal(column("learning_attempt_questions", "score_weight")?.data_type, "tinyint");
  assert.equal(column("vocabulary_items", "image_search_terms_json")?.data_type, "json");
  assert.equal(column("learning_assignment_items", "image_search_terms_json")?.data_type, "json");
  assert.equal(column("google_sheet_sync_outbox", "lesson_id")?.is_nullable, "YES");
  assert.match(String(column("google_sheet_sync_outbox", "event_type")?.column_type), /VOCABULARY_ATTEMPT_UPSERT/);

  const [constraints] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME table_name,CONSTRAINT_NAME constraint_name,
       CONSTRAINT_TYPE constraint_type
     FROM information_schema.table_constraints
     WHERE table_schema=DATABASE() AND (
       table_name='learning_attempt_question_items'
       OR (table_name='google_sheet_sync_outbox'
         AND constraint_name='uq_google_sync_logical_entity')
     )`,
  );
  assert.ok(constraints.some((row) => row.constraint_name === "PRIMARY"));
  assert.ok(constraints.some((row) => row.constraint_name === "fk_learning_question_item_question"));
  assert.ok(constraints.some((row) => row.constraint_name === "fk_learning_question_item_assignment_item"));
  assert.ok(constraints.some((row) => row.constraint_name === "uq_google_sync_logical_entity"));

  const [indexes] = await pool.query<RowDataPacket[]>(
    `SELECT INDEX_NAME index_name FROM information_schema.statistics
     WHERE table_schema=DATABASE()
       AND table_name='learning_attempt_question_items'`,
  );
  assert.ok(indexes.some((row) => row.index_name === "idx_learning_question_item_results"));

  const [triggers] = await pool.query<RowDataPacket[]>(
    `SELECT ACTION_STATEMENT action_statement FROM information_schema.triggers
     WHERE trigger_schema=DATABASE()
       AND trigger_name='trg_learning_question_item_fallback'`,
  );
  assert.equal(triggers.length, 1);
  assert.match(String(triggers[0].action_statement), /NEW\.first_attempt_correct/);
  assert.match(String(triggers[0].action_statement), /NEW\.final_correct/);

  const connection = await pool.getConnection();
  try {
    await connection.query("CREATE TEMPORARY TABLE v20f_rollback_probe (id INT PRIMARY KEY)");
    await connection.beginTransaction();
    await connection.query("INSERT INTO v20f_rollback_probe VALUES (1)");
    await assert.rejects(connection.query("INSERT INTO v20f_rollback_probe VALUES (1)"));
    await connection.rollback();
    const [probe] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) count FROM v20f_rollback_probe",
    );
    assert.equal(Number(probe[0].count), 0);
  } finally {
    connection.release();
  }
});
