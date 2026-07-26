ALTER TABLE learning_assignments
  ADD COLUMN open_access_version INT UNSIGNED NOT NULL DEFAULT 1
    AFTER open_access_revoked_at;

ALTER TABLE learning_assignment_recipients
  ADD COLUMN access_version INT UNSIGNED NOT NULL DEFAULT 1
    AFTER token_revoked_at;

CREATE TABLE learning_access_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NULL,
  guest_name VARCHAR(80) NULL,
  session_token_hash CHAR(64) NOT NULL,
  access_version_snapshot INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  last_activity_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_access_session_assignment
    FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id),
  CONSTRAINT fk_learning_access_session_recipient
    FOREIGN KEY (recipient_id) REFERENCES learning_assignment_recipients(id),
  CONSTRAINT chk_learning_access_session_identity CHECK (
    (recipient_id IS NOT NULL AND guest_name IS NULL) OR
    (recipient_id IS NULL)
  ),
  UNIQUE KEY uq_learning_access_session_token (session_token_hash),
  INDEX idx_learning_access_session_assignment
    (assignment_id,recipient_id,expires_at),
  INDEX idx_learning_access_session_expiry (expires_at,revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL,
  access_session_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NULL,
  guest_name VARCHAR(80) NULL,
  attempt_number TINYINT UNSIGNED NULL,
  status ENUM('IN_PROGRESS','COMPLETED','ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
  random_seed CHAR(64) NOT NULL,
  session_token_hash CHAR(64) NOT NULL,
  session_expires_at DATETIME NOT NULL,
  generation_warnings_json JSON NOT NULL,
  started_at DATETIME NOT NULL,
  last_activity_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  correct_first_try_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  correct_after_retry_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  final_correct_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  total_questions SMALLINT UNSIGNED NOT NULL,
  graded_question_count SMALLINT UNSIGNED NOT NULL,
  score_percent TINYINT UNSIGNED NULL,
  reward_snapshot_json JSON NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_attempt_assignment
    FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id),
  CONSTRAINT fk_learning_attempt_access_session
    FOREIGN KEY (access_session_id) REFERENCES learning_access_sessions(id),
  CONSTRAINT fk_learning_attempt_recipient
    FOREIGN KEY (recipient_id) REFERENCES learning_assignment_recipients(id),
  CONSTRAINT chk_learning_attempt_identity CHECK (
    (recipient_id IS NOT NULL AND guest_name IS NULL AND attempt_number IS NOT NULL) OR
    (recipient_id IS NULL AND attempt_number IS NULL)
  ),
  CONSTRAINT chk_learning_attempt_score CHECK (
    score_percent IS NULL OR score_percent BETWEEN 0 AND 100
  ),
  UNIQUE KEY uq_learning_attempt_session_token (session_token_hash),
  UNIQUE KEY uq_learning_attempt_access_session (access_session_id),
  UNIQUE KEY uq_learning_attempt_recipient_number
    (assignment_id,recipient_id,attempt_number),
  INDEX idx_learning_attempt_assignment_status
    (assignment_id,status,started_at),
  INDEX idx_learning_attempt_recipient
    (recipient_id,status,attempt_number),
  INDEX idx_learning_attempt_expiry (session_expires_at,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_attempt_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  assignment_item_id BIGINT UNSIGNED NOT NULL,
  activity_id BIGINT UNSIGNED NOT NULL,
  question_key VARCHAR(100) NOT NULL,
  adaptive_source_key VARCHAR(100) NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  mechanic ENUM(
    'EXPLORE_CARD','SELECT_ONE','MATCH_PAIRS','MEMORY_PAIRS',
    'ORDER_TOKENS','BUILD_WORD','SORT_ITEMS','REPEAT_AUDIO'
  ) NOT NULL,
  presentation VARCHAR(50) NOT NULL,
  prompt_snapshot_json JSON NOT NULL,
  options_snapshot_json JSON NOT NULL,
  correct_answer_snapshot_json JSON NOT NULL,
  graded BOOLEAN NOT NULL DEFAULT TRUE,
  status ENUM('PENDING','IN_PROGRESS','ANSWERED','SKIPPED','CONDITIONAL')
    NOT NULL DEFAULT 'PENDING',
  first_attempt_correct BOOLEAN NULL,
  final_correct BOOLEAN NULL,
  retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  skip_reason VARCHAR(100) NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_attempt_question_attempt
    FOREIGN KEY (attempt_id) REFERENCES learning_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_learning_attempt_question_item
    FOREIGN KEY (assignment_item_id) REFERENCES learning_assignment_items(id),
  CONSTRAINT fk_learning_attempt_question_activity
    FOREIGN KEY (activity_id) REFERENCES learning_assignment_activities(id),
  CONSTRAINT chk_learning_attempt_question_sequence CHECK (
    sequence_number BETWEEN 1 AND 400
  ),
  UNIQUE KEY uq_learning_attempt_question_sequence (attempt_id,sequence_number),
  UNIQUE KEY uq_learning_attempt_question_key (attempt_id,question_key),
  INDEX idx_learning_attempt_question_current (attempt_id,status,sequence_number),
  INDEX idx_learning_attempt_question_item (attempt_id,assignment_item_id,graded)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_attempt_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  attempt_question_id BIGINT UNSIGNED NOT NULL,
  client_answer_id CHAR(36) NOT NULL,
  answer_sequence TINYINT UNSIGNED NOT NULL,
  submitted_answer_json JSON NOT NULL,
  submitted_answer_sha256 CHAR(64) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_snapshot_json JSON NOT NULL,
  submitted_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_attempt_answer_attempt
    FOREIGN KEY (attempt_id) REFERENCES learning_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_learning_attempt_answer_question
    FOREIGN KEY (attempt_question_id) REFERENCES learning_attempt_questions(id)
      ON DELETE CASCADE,
  CONSTRAINT chk_learning_attempt_answer_sequence CHECK (
    answer_sequence BETWEEN 1 AND 3
  ),
  UNIQUE KEY uq_learning_attempt_answer_client (client_answer_id),
  UNIQUE KEY uq_learning_attempt_answer_sequence
    (attempt_question_id,answer_sequence),
  INDEX idx_learning_attempt_answer_attempt (attempt_id,submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
