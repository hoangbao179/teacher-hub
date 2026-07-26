ALTER TABLE vocabulary_items
  ADD COLUMN image_search_terms_json JSON NULL
    AFTER supports_image_game;

ALTER TABLE learning_assignment_items
  ADD COLUMN image_search_terms_json JSON NULL
    AFTER supports_image_game;

UPDATE vocabulary_items SET image_search_terms_json=JSON_ARRAY(word);
UPDATE learning_assignment_items SET image_search_terms_json=JSON_ARRAY(word);

ALTER TABLE learning_attempt_questions
  ADD COLUMN question_kind ENUM('PRIMARY','REVIEW','EXPOSURE')
    NOT NULL DEFAULT 'PRIMARY' AFTER graded,
  ADD COLUMN score_weight TINYINT UNSIGNED
    NOT NULL DEFAULT 1 AFTER question_kind,
  ADD CONSTRAINT chk_learning_question_score_weight
    CHECK (score_weight IN (0,1));

UPDATE learning_attempt_questions
SET question_kind=CASE
      WHEN graded=0 THEN 'EXPOSURE'
      WHEN adaptive_source_key IS NOT NULL THEN 'REVIEW'
      ELSE 'PRIMARY'
    END,
    score_weight=CASE
      WHEN graded=1 AND adaptive_source_key IS NULL THEN 1
      ELSE 0
    END;

CREATE TABLE learning_attempt_question_items (
  question_id BIGINT UNSIGNED NOT NULL,
  assignment_item_id BIGINT UNSIGNED NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  item_role VARCHAR(30) NULL,
  first_attempt_correct BOOLEAN NULL,
  final_correct BOOLEAN NULL,
  retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (question_id,assignment_item_id),
  CONSTRAINT fk_learning_question_item_question
    FOREIGN KEY (question_id) REFERENCES learning_attempt_questions(id)
      ON DELETE CASCADE,
  CONSTRAINT fk_learning_question_item_assignment_item
    FOREIGN KEY (assignment_item_id) REFERENCES learning_assignment_items(id),
  CONSTRAINT chk_learning_question_item_order
    CHECK (display_order BETWEEN 1 AND 100),
  INDEX idx_learning_question_item_results
    (assignment_item_id,question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO learning_attempt_question_items
  (question_id,assignment_item_id,display_order,first_attempt_correct,
   final_correct,retry_count)
SELECT id,assignment_item_id,1,first_attempt_correct,final_correct,retry_count
FROM learning_attempt_questions;

CREATE TRIGGER trg_learning_question_item_fallback
AFTER INSERT ON learning_attempt_questions
FOR EACH ROW
INSERT INTO learning_attempt_question_items
  (question_id,assignment_item_id,display_order)
VALUES (NEW.id,NEW.assignment_item_id,1);

ALTER TABLE google_sheet_sync_outbox
  DROP FOREIGN KEY fk_google_sync_outbox_lesson,
  DROP INDEX uq_google_sync_logical_event,
  MODIFY lesson_id BIGINT UNSIGNED NULL,
  MODIFY event_type ENUM(
    'LESSON_UPSERT','LESSON_REMOVE','VOCABULARY_ATTEMPT_UPSERT'
  ) NOT NULL,
  ADD COLUMN entity_type ENUM('LESSON','VOCABULARY_ATTEMPT')
    NOT NULL DEFAULT 'LESSON' AFTER student_id,
  ADD COLUMN entity_id BIGINT UNSIGNED NULL AFTER entity_type;

UPDATE google_sheet_sync_outbox
SET entity_type='LESSON',entity_id=lesson_id
WHERE entity_id IS NULL;

ALTER TABLE google_sheet_sync_outbox
  MODIFY entity_id BIGINT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_google_sync_logical_entity
    (student_id,entity_type,entity_id,event_type),
  ADD INDEX idx_google_sync_entity (entity_type,entity_id),
  ADD CONSTRAINT fk_google_sync_outbox_lesson
    FOREIGN KEY (lesson_id) REFERENCES lesson_sessions(id);
