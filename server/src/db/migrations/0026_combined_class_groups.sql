CREATE TABLE combined_class_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  status ENUM('ACTIVE','ENDED') NOT NULL DEFAULT 'ACTIVE',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_combined_group_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_combined_group_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  INDEX idx_combined_group_effective (status,effective_from,effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE combined_class_group_classes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_combined_group_class_group FOREIGN KEY (group_id) REFERENCES combined_class_groups(id),
  CONSTRAINT fk_combined_group_class_class FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE KEY uq_combined_group_class (group_id,class_id),
  INDEX idx_combined_group_class_class (class_id,group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE combined_class_group_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Monday..7=Sunday',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_combined_group_schedule_group FOREIGN KEY (group_id) REFERENCES combined_class_groups(id),
  CONSTRAINT chk_combined_group_schedule_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_combined_group_schedule_time CHECK (end_time > start_time),
  UNIQUE KEY uq_combined_group_schedule (group_id,day_of_week,start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE combined_teaching_occurrences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  group_schedule_id BIGINT UNSIGNED NOT NULL,
  occurrence_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  status ENUM('DRAFT','COMPLETED','SKIPPED','RESCHEDULED') NOT NULL DEFAULT 'DRAFT',
  replacement_date DATE NULL,
  replacement_start_time TIME NULL,
  replacement_end_time TIME NULL,
  reason VARCHAR(255) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_combined_occurrence_group FOREIGN KEY (group_id) REFERENCES combined_class_groups(id),
  CONSTRAINT fk_combined_occurrence_schedule FOREIGN KEY (group_schedule_id) REFERENCES combined_class_group_schedules(id),
  CONSTRAINT fk_combined_occurrence_actor FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_combined_occurrence (group_schedule_id,occurrence_date),
  INDEX idx_combined_occurrence_group_date (group_id,occurrence_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE lesson_sessions
  ADD COLUMN combined_teaching_occurrence_id BIGINT UNSIGNED NULL AFTER source_occurrence_key,
  ADD CONSTRAINT fk_lesson_combined_occurrence
    FOREIGN KEY (combined_teaching_occurrence_id) REFERENCES combined_teaching_occurrences(id),
  ADD UNIQUE KEY uq_combined_occurrence_class (combined_teaching_occurrence_id,class_id);
