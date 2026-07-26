CREATE TABLE learning_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_user_id BIGINT UNSIGNED NOT NULL,
  vocabulary_set_id BIGINT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  instruction VARCHAR(1000) NULL,
  audience_type ENUM('CLASS','SELECTED_STUDENTS','OPEN_LINK') NULL,
  class_id BIGINT UNSIGNED NULL,
  public_code CHAR(8) NULL,
  open_access_token_hash CHAR(64) NULL,
  open_access_revoked_at DATETIME NULL,
  status ENUM('DRAFT','PUBLISHED','CLOSED') NOT NULL DEFAULT 'DRAFT',
  template_code ENUM('YOUNG_BEGINNER','WORD_RECOGNITION','SPELLING_REVIEW','PRE_TEST_REVIEW','CUSTOM') NOT NULL,
  age_band ENUM('PRESCHOOL_G1','G2_G3','G4_G5','G6_G9') NOT NULL,
  available_from DATETIME NULL,
  due_at DATETIME NULL,
  max_attempts TINYINT UNSIGNED NULL,
  pass_score TINYINT UNSIGNED NULL,
  answer_feedback_mode ENUM('IMMEDIATE','AFTER_COMPLETION') NOT NULL DEFAULT 'IMMEDIATE',
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  published_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_assignments_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_assignments_set FOREIGN KEY (vocabulary_set_id) REFERENCES vocabulary_sets(id),
  CONSTRAINT fk_learning_assignments_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT chk_learning_assignment_title CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 160),
  CONSTRAINT chk_learning_assignment_attempts CHECK (max_attempts IS NULL OR max_attempts BETWEEN 1 AND 10),
  CONSTRAINT chk_learning_assignment_score CHECK (pass_score IS NULL OR pass_score BETWEEN 0 AND 100),
  CONSTRAINT chk_learning_assignment_dates CHECK (due_at IS NULL OR available_from IS NULL OR due_at>available_from),
  CONSTRAINT chk_learning_assignment_class_audience CHECK (
    (audience_type='CLASS' AND class_id IS NOT NULL) OR
    (audience_type IS NULL OR audience_type<>'CLASS') AND class_id IS NULL
  ),
  UNIQUE KEY uq_learning_assignments_public_code (public_code),
  INDEX idx_learning_assignments_teacher_status (teacher_user_id,status,updated_at),
  INDEX idx_learning_assignments_audience (audience_type,age_band),
  INDEX idx_learning_assignments_due (due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_assignment_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL,
  source_vocabulary_item_id BIGINT UNSIGNED NULL,
  stored_media_id BIGINT UNSIGNED NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  word VARCHAR(100) NOT NULL,
  normalized_word VARCHAR(100) NOT NULL,
  meaning_vi VARCHAR(200) NOT NULL,
  phonetic VARCHAR(100) NULL,
  part_of_speech VARCHAR(50) NULL,
  example_en VARCHAR(500) NULL,
  speech_text VARCHAR(200) NOT NULL,
  tier ENUM('CORE','EXTENDED','CUSTOM') NOT NULL,
  illustration_snapshot_json JSON NOT NULL,
  supports_image_game BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_items_assignment FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_items_source FOREIGN KEY (source_vocabulary_item_id) REFERENCES vocabulary_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_assignment_items_media FOREIGN KEY (stored_media_id) REFERENCES vocabulary_media(id),
  CONSTRAINT chk_assignment_item_order CHECK (display_order BETWEEN 1 AND 40),
  UNIQUE KEY uq_assignment_item_order (assignment_id,display_order),
  INDEX idx_assignment_items_source (source_vocabulary_item_id),
  INDEX idx_assignment_items_media (stored_media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_assignment_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL,
  mechanic ENUM('EXPLORE_CARD','SELECT_ONE','MATCH_PAIRS','MEMORY_PAIRS','ORDER_TOKENS','BUILD_WORD','SORT_ITEMS','REPEAT_AUDIO') NOT NULL,
  presentation VARCHAR(50) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_activities_assignment FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id) ON DELETE CASCADE,
  CONSTRAINT chk_assignment_activity_order CHECK (display_order BETWEEN 1 AND 8),
  UNIQUE KEY uq_assignment_activity_order (assignment_id,display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_assignment_audience_students (
  assignment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id,student_id),
  CONSTRAINT fk_assignment_audience_assignment FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_audience_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_assignment_recipients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  student_name_snapshot VARCHAR(160) NOT NULL,
  access_token_hash CHAR(64) NOT NULL,
  assigned_at DATETIME NOT NULL,
  token_revoked_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_recipients_assignment FOREIGN KEY (assignment_id) REFERENCES learning_assignments(id),
  CONSTRAINT fk_assignment_recipients_student FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE KEY uq_assignment_recipient_student (assignment_id,student_id),
  UNIQUE KEY uq_assignment_recipient_token (access_token_hash),
  INDEX idx_assignment_recipients_assignment (assignment_id,token_revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
