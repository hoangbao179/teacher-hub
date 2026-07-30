import type { PoolConnection, RowDataPacket } from "mysql2/promise";

const V20F_STABILIZATION = "0021_v20f_vocabulary_stabilization.sql";
const V20F_FALLBACK = "0022_v20f_question_item_fallback.sql";

type CountRow = RowDataPacket & { count: number | string };
type TriggerRow = RowDataPacket & { action_statement: string };

async function count(
  connection: PoolConnection,
  sql: string,
  parameters: unknown[],
): Promise<number> {
  const [rows] = await connection.query<CountRow[]>(sql, parameters);
  return Number(rows[0]?.count ?? 0);
}

async function migrationApplied(
  connection: PoolConnection,
  version: string,
): Promise<boolean> {
  return (await count(
    connection,
    "SELECT COUNT(*) count FROM schema_migrations WHERE version=?",
    [version],
  )) > 0;
}

async function tableExists(
  connection: PoolConnection,
  table: string,
): Promise<boolean> {
  return (await count(
    connection,
    `SELECT COUNT(*) count FROM information_schema.tables
     WHERE table_schema=DATABASE() AND table_name=?`,
    [table],
  )) > 0;
}

async function columnExists(
  connection: PoolConnection,
  table: string,
  column: string,
): Promise<boolean> {
  return (await count(
    connection,
    `SELECT COUNT(*) count FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`,
    [table, column],
  )) > 0;
}

async function constraintExists(
  connection: PoolConnection,
  table: string,
  constraint: string,
): Promise<boolean> {
  return (await count(
    connection,
    `SELECT COUNT(*) count FROM information_schema.table_constraints
     WHERE table_schema=DATABASE() AND table_name=? AND constraint_name=?`,
    [table, constraint],
  )) > 0;
}

async function indexExists(
  connection: PoolConnection,
  table: string,
  index: string,
): Promise<boolean> {
  return (await count(
    connection,
    `SELECT COUNT(*) count FROM information_schema.statistics
     WHERE table_schema=DATABASE() AND table_name=? AND index_name=?`,
    [table, index],
  )) > 0;
}

async function triggerStatement(
  connection: PoolConnection,
  trigger: string,
): Promise<string | null> {
  const [rows] = await connection.query<TriggerRow[]>(
    `SELECT ACTION_STATEMENT action_statement FROM information_schema.triggers
     WHERE trigger_schema=DATABASE() AND trigger_name=?`,
    [trigger],
  );
  return rows[0]?.action_statement ?? null;
}

async function hasPartialV20fStabilization(
  connection: PoolConnection,
): Promise<boolean> {
  const probes: Array<[string, string]> = [
    ["vocabulary_items", "image_search_terms_json"],
    ["learning_assignment_items", "image_search_terms_json"],
    ["learning_attempt_questions", "question_kind"],
    ["learning_attempt_questions", "score_weight"],
    ["google_sheet_sync_outbox", "entity_type"],
    ["google_sheet_sync_outbox", "entity_id"],
  ];

  for (const [table, column] of probes) {
    if (await columnExists(connection, table, column)) return true;
  }

  return (await tableExists(connection, "learning_attempt_question_items"))
    || (await triggerStatement(connection, "trg_learning_question_item_fallback")) !== null;
}

async function ensureV20fVocabularyColumns(
  connection: PoolConnection,
): Promise<void> {
  if (!await columnExists(connection, "vocabulary_items", "image_search_terms_json")) {
    await connection.query(`ALTER TABLE vocabulary_items
      ADD COLUMN image_search_terms_json JSON NULL AFTER supports_image_game`);
  }
  if (!await columnExists(connection, "learning_assignment_items", "image_search_terms_json")) {
    await connection.query(`ALTER TABLE learning_assignment_items
      ADD COLUMN image_search_terms_json JSON NULL AFTER supports_image_game`);
  }

  await connection.query(`UPDATE vocabulary_items
    SET image_search_terms_json=JSON_ARRAY(word)
    WHERE image_search_terms_json IS NULL`);
  await connection.query(`UPDATE learning_assignment_items
    SET image_search_terms_json=JSON_ARRAY(word)
    WHERE image_search_terms_json IS NULL`);
}

async function ensureV20fQuestionAnalytics(
  connection: PoolConnection,
): Promise<void> {
  if (!await columnExists(connection, "learning_attempt_questions", "question_kind")) {
    await connection.query(`ALTER TABLE learning_attempt_questions
      ADD COLUMN question_kind ENUM('PRIMARY','REVIEW','EXPOSURE')
        NOT NULL DEFAULT 'PRIMARY' AFTER graded`);
  }
  if (!await columnExists(connection, "learning_attempt_questions", "score_weight")) {
    await connection.query(`ALTER TABLE learning_attempt_questions
      ADD COLUMN score_weight TINYINT UNSIGNED
        NOT NULL DEFAULT 1 AFTER question_kind`);
  }
  if (!await constraintExists(
    connection,
    "learning_attempt_questions",
    "chk_learning_question_score_weight",
  )) {
    await connection.query(`ALTER TABLE learning_attempt_questions
      ADD CONSTRAINT chk_learning_question_score_weight
      CHECK (score_weight IN (0,1))`);
  }

  await connection.query(`UPDATE learning_attempt_questions
    SET question_kind=CASE
          WHEN graded=0 THEN 'EXPOSURE'
          WHEN adaptive_source_key IS NOT NULL THEN 'REVIEW'
          ELSE 'PRIMARY'
        END,
        score_weight=CASE
          WHEN graded=1 AND adaptive_source_key IS NULL THEN 1
          ELSE 0
        END`);

  await connection.query(`CREATE TABLE IF NOT EXISTS learning_attempt_question_items (
    question_id BIGINT UNSIGNED NOT NULL,
    assignment_item_id BIGINT UNSIGNED NOT NULL,
    display_order SMALLINT UNSIGNED NOT NULL,
    item_role VARCHAR(30) NULL,
    first_attempt_correct BOOLEAN NULL,
    final_correct BOOLEAN NULL,
    retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (question_id,assignment_item_id),
    CONSTRAINT fk_learning_question_item_question
      FOREIGN KEY (question_id) REFERENCES learning_attempt_questions(id) ON DELETE CASCADE,
    CONSTRAINT fk_learning_question_item_assignment_item
      FOREIGN KEY (assignment_item_id) REFERENCES learning_assignment_items(id),
    CONSTRAINT chk_learning_question_item_order CHECK (display_order BETWEEN 1 AND 100),
    INDEX idx_learning_question_item_results (assignment_item_id,question_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`INSERT INTO learning_attempt_question_items
    (question_id,assignment_item_id,display_order,first_attempt_correct,
     final_correct,retry_count)
    SELECT id,assignment_item_id,1,first_attempt_correct,final_correct,retry_count
    FROM learning_attempt_questions
    ON DUPLICATE KEY UPDATE
      first_attempt_correct=VALUES(first_attempt_correct),
      final_correct=VALUES(final_correct),
      retry_count=VALUES(retry_count)`);

  if (await triggerStatement(connection, "trg_learning_question_item_fallback") === null) {
    await connection.query(`CREATE TRIGGER trg_learning_question_item_fallback
      AFTER INSERT ON learning_attempt_questions
      FOR EACH ROW
      INSERT INTO learning_attempt_question_items
        (question_id,assignment_item_id,display_order)
      VALUES (NEW.id,NEW.assignment_item_id,1)`);
  }
}

async function ensureV20fOutbox(connection: PoolConnection): Promise<void> {
  if (await constraintExists(
    connection,
    "google_sheet_sync_outbox",
    "fk_google_sync_outbox_lesson",
  )) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      DROP FOREIGN KEY fk_google_sync_outbox_lesson`);
  }
  if (await indexExists(
    connection,
    "google_sheet_sync_outbox",
    "uq_google_sync_logical_event",
  )) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      DROP INDEX uq_google_sync_logical_event`);
  }

  await connection.query(`ALTER TABLE google_sheet_sync_outbox
    MODIFY lesson_id BIGINT UNSIGNED NULL`);
  await connection.query(`ALTER TABLE google_sheet_sync_outbox
    MODIFY event_type ENUM(
      'LESSON_UPSERT','LESSON_REMOVE','VOCABULARY_ATTEMPT_UPSERT'
    ) NOT NULL`);

  if (!await columnExists(connection, "google_sheet_sync_outbox", "entity_type")) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      ADD COLUMN entity_type ENUM('LESSON','VOCABULARY_ATTEMPT')
        NOT NULL DEFAULT 'LESSON' AFTER student_id`);
  }
  if (!await columnExists(connection, "google_sheet_sync_outbox", "entity_id")) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      ADD COLUMN entity_id BIGINT UNSIGNED NULL AFTER entity_type`);
  }

  await connection.query(`UPDATE google_sheet_sync_outbox
    SET entity_type='LESSON',entity_id=lesson_id
    WHERE entity_id IS NULL`);
  await connection.query(`ALTER TABLE google_sheet_sync_outbox
    MODIFY entity_id BIGINT UNSIGNED NOT NULL`);

  if (!await indexExists(
    connection,
    "google_sheet_sync_outbox",
    "uq_google_sync_logical_entity",
  )) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      ADD UNIQUE KEY uq_google_sync_logical_entity
        (student_id,entity_type,entity_id,event_type)`);
  }
  if (!await indexExists(
    connection,
    "google_sheet_sync_outbox",
    "idx_google_sync_entity",
  )) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      ADD INDEX idx_google_sync_entity (entity_type,entity_id)`);
  }
  if (!await constraintExists(
    connection,
    "google_sheet_sync_outbox",
    "fk_google_sync_outbox_lesson",
  )) {
    await connection.query(`ALTER TABLE google_sheet_sync_outbox
      ADD CONSTRAINT fk_google_sync_outbox_lesson
      FOREIGN KEY (lesson_id) REFERENCES lesson_sessions(id)`);
  }
}

async function recoverV20fStabilization(
  connection: PoolConnection,
): Promise<void> {
  console.warn(`Recovering interrupted migration ${V20F_STABILIZATION}`);
  await ensureV20fVocabularyColumns(connection);
  await ensureV20fQuestionAnalytics(connection);
  await ensureV20fOutbox(connection);
  await connection.query(
    "INSERT IGNORE INTO schema_migrations(version) VALUES (?)",
    [V20F_STABILIZATION],
  );
  console.log(`Recovered ${V20F_STABILIZATION}`);
}

async function recoverV20fFallback(connection: PoolConnection): Promise<void> {
  console.warn(`Recovering interrupted migration ${V20F_FALLBACK}`);
  await connection.query("DROP TRIGGER IF EXISTS trg_learning_question_item_fallback");
  await connection.query(`ALTER TABLE vocabulary_items
    MODIFY image_search_terms_json JSON NULL`);
  await connection.query(`ALTER TABLE learning_assignment_items
    MODIFY image_search_terms_json JSON NULL`);
  await connection.query(`CREATE TRIGGER trg_learning_question_item_fallback
    AFTER INSERT ON learning_attempt_questions
    FOR EACH ROW
    INSERT INTO learning_attempt_question_items
      (question_id,assignment_item_id,display_order,first_attempt_correct,
       final_correct,retry_count)
    VALUES (
      NEW.id,NEW.assignment_item_id,1,NEW.first_attempt_correct,
      NEW.final_correct,NEW.retry_count
    )`);
  await connection.query(
    "INSERT IGNORE INTO schema_migrations(version) VALUES (?)",
    [V20F_FALLBACK],
  );
  console.log(`Recovered ${V20F_FALLBACK}`);
}

export async function recoverInterruptedMigrations(
  connection: PoolConnection,
): Promise<void> {
  if (!await migrationApplied(connection, V20F_STABILIZATION)
      && await hasPartialV20fStabilization(connection)) {
    await recoverV20fStabilization(connection);
  }

  if (!await migrationApplied(connection, V20F_STABILIZATION)
      || await migrationApplied(connection, V20F_FALLBACK)) {
    return;
  }

  const fallback = await triggerStatement(
    connection,
    "trg_learning_question_item_fallback",
  );
  if (fallback === null || fallback.includes("NEW.first_attempt_correct")) {
    await recoverV20fFallback(connection);
  }
}
