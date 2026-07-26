ALTER TABLE lesson_sessions
  ADD COLUMN general_comment TEXT NULL AFTER homework;

CREATE TABLE google_sheet_sync_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('LESSON_UPSERT','LESSON_REMOVE') NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  payload_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('PENDING','PROCESSING','RETRY','SUCCEEDED','DEAD') NOT NULL DEFAULT 'PENDING',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  locked_by VARCHAR(190) NULL,
  last_error_code VARCHAR(80) NULL,
  last_error_message VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  CONSTRAINT fk_google_sync_outbox_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_google_sync_outbox_lesson FOREIGN KEY (lesson_id) REFERENCES lesson_sessions(id),
  CONSTRAINT chk_google_sync_outbox_revision CHECK (revision > 0),
  CONSTRAINT chk_google_sync_outbox_payload_version CHECK (payload_version > 0),
  UNIQUE KEY uq_google_sync_logical_event (student_id,lesson_id,event_type),
  INDEX idx_google_sync_ready (status,next_attempt_at),
  INDEX idx_google_sync_locked (locked_at),
  INDEX idx_google_sync_student (student_id),
  INDEX idx_google_sync_lesson (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
