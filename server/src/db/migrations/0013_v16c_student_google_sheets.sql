CREATE TABLE student_google_sheets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  legacy_import_id BIGINT UNSIGNED NULL,
  spreadsheet_id VARCHAR(190) NULL,
  file_name VARCHAR(255) NOT NULL,
  web_view_url VARCHAR(1000) NULL,
  root_folder_id VARCHAR(190) NOT NULL,
  template_version VARCHAR(40) NOT NULL,
  status ENUM('CREATING','ACTIVE','GENERATION_ERROR','ARCHIVED') NOT NULL,
  sharing_status ENUM('RESTRICTED','MANUALLY_SHARED') NOT NULL DEFAULT 'RESTRICTED',
  source_import_sha256 CHAR(64) NULL,
  last_generated_at DATETIME NULL,
  last_synced_at DATETIME NULL,
  last_sync_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,
  active_guard TINYINT GENERATED ALWAYS AS (
    CASE WHEN status IN ('CREATING','ACTIVE') THEN 1 ELSE NULL END
  ) STORED,
  CONSTRAINT fk_student_google_sheet_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_student_google_sheet_import FOREIGN KEY (legacy_import_id) REFERENCES legacy_imports(id),
  UNIQUE KEY uq_student_google_sheet_active (student_id,active_guard),
  UNIQUE KEY uq_student_google_sheet_spreadsheet (spreadsheet_id),
  INDEX idx_student_google_sheet_status (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
