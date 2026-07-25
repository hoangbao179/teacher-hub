ALTER TABLE lesson_attendances
  DROP CHECK chk_attendance_billable_status,
  MODIFY attendance_status ENUM('PRESENT','ABSENT','FREE','ABSENT_CHARGED') NOT NULL,
  ADD CONSTRAINT chk_attendance_billable_status CHECK (
    counts_for_tuition=0 OR attendance_status IN ('PRESENT','ABSENT_CHARGED')
  );

CREATE TABLE legacy_imports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  status ENUM('APPLYING','APPLIED','FAILED') NOT NULL DEFAULT 'APPLYING',
  total_row_count INT UNSIGNED NOT NULL,
  accepted_row_count INT UNSIGNED NOT NULL DEFAULT 0,
  resolved_row_count INT UNSIGNED NOT NULL DEFAULT 0,
  skipped_row_count INT UNSIGNED NOT NULL DEFAULT 0,
  imported_lesson_count INT UNSIGNED NOT NULL DEFAULT 0,
  imported_attendance_count INT UNSIGNED NOT NULL DEFAULT 0,
  imported_class_count INT UNSIGNED NOT NULL DEFAULT 0,
  imported_enrollment_count INT UNSIGNED NOT NULL DEFAULT 0,
  imported_tuition_cycle_count INT UNSIGNED NOT NULL DEFAULT 0,
  applied_by_user_id BIGINT UNSIGNED NOT NULL,
  applied_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_legacy_import_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_legacy_import_actor FOREIGN KEY (applied_by_user_id) REFERENCES users(id),
  UNIQUE KEY uq_legacy_import_student_sha (student_id,sha256),
  INDEX idx_legacy_import_status (status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE legacy_import_row_audits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  legacy_import_id BIGINT UNSIGNED NOT NULL,
  source_sheet VARCHAR(160) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  row_status ENUM('VALID','NEEDS_REVIEW','BLOCKED','RESOLVED','SKIPPED') NOT NULL,
  issue_code VARCHAR(80) NOT NULL,
  resolution_action VARCHAR(80) NULL,
  raw_snapshot_json JSON NOT NULL,
  normalized_snapshot_json JSON NOT NULL,
  skip_reason VARCHAR(255) NULL,
  resolved_by_user_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_legacy_row_import FOREIGN KEY (legacy_import_id) REFERENCES legacy_imports(id),
  CONSTRAINT fk_legacy_row_actor FOREIGN KEY (resolved_by_user_id) REFERENCES users(id),
  UNIQUE KEY uq_legacy_row_issue (legacy_import_id,source_sheet,source_row,issue_code),
  INDEX idx_legacy_row_status (legacy_import_id,row_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE legacy_import_lesson_links (
  legacy_import_id BIGINT UNSIGNED NOT NULL,
  source_sheet VARCHAR(160) NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  attendance_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (legacy_import_id,source_sheet,source_row),
  CONSTRAINT fk_legacy_link_import FOREIGN KEY (legacy_import_id) REFERENCES legacy_imports(id),
  CONSTRAINT fk_legacy_link_lesson FOREIGN KEY (lesson_id) REFERENCES lesson_sessions(id),
  CONSTRAINT fk_legacy_link_attendance FOREIGN KEY (attendance_id) REFERENCES lesson_attendances(id),
  INDEX idx_legacy_link_lesson (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
