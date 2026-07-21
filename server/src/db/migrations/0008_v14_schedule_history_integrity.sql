ALTER TABLE lesson_sessions
  ADD COLUMN class_name_snapshot VARCHAR(160) NULL AFTER class_id,
  ADD COLUMN class_type_snapshot ENUM('ONE_TO_ONE','GROUP') NULL AFTER class_name_snapshot,
  ADD COLUMN subject_snapshot VARCHAR(120) NULL AFTER class_type_snapshot,
  ADD COLUMN makeup_source_occurrence_key VARCHAR(160) NULL AFTER source_occurrence_key,
  ADD COLUMN cancelled_at DATETIME NULL AFTER completed_at,
  ADD COLUMN cancelled_by BIGINT UNSIGNED NULL AFTER cancelled_at,
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER cancelled_by,
  ADD CONSTRAINT fk_lesson_cancel_actor FOREIGN KEY (cancelled_by) REFERENCES users(id),
  ADD INDEX idx_lesson_makeup_source (makeup_source_occurrence_key);

UPDATE lesson_sessions l
JOIN classes c ON c.id=l.class_id
SET l.class_name_snapshot=c.name,
    l.class_type_snapshot=c.class_type,
    l.subject_snapshot=c.subject;

INSERT IGNORE INTO schedule_exceptions
  (class_id,recurring_schedule_id,original_date,original_start_time,original_end_time,
   exception_type,reason)
SELECT l.class_id,rs.id,l.session_date,rs.start_time,rs.end_time,'SKIPPED',
  'Bản nháp đã hủy trước khi nâng cấp'
FROM lesson_sessions l
JOIN recurring_schedules rs
  ON l.source_occurrence_key=CONCAT(l.class_id,':',rs.id,':',DATE_FORMAT(l.session_date,'%Y-%m-%d'))
WHERE l.status='CANCELLED';

ALTER TABLE lesson_session_participants
  ADD COLUMN student_name_snapshot VARCHAR(150) NULL AFTER enrollment_id,
  ADD COLUMN student_nickname_snapshot VARCHAR(100) NULL AFTER student_name_snapshot;

UPDATE lesson_session_participants p
JOIN class_enrollments e ON e.id=p.enrollment_id
JOIN students s ON s.id=e.student_id
SET p.student_name_snapshot=s.full_name,
    p.student_nickname_snapshot=s.nickname;

CREATE TABLE class_active_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  active_from DATE NOT NULL,
  active_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_class_active_period_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_class_active_period_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_class_active_period_dates CHECK (active_to IS NULL OR active_to>=active_from),
  UNIQUE KEY uq_class_active_period_start (class_id,active_from),
  INDEX idx_class_active_period_effective (class_id,active_from,active_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO class_active_periods(class_id,active_from,active_to)
SELECT id,start_date,
  CASE
    WHEN status='ACTIVE' THEN NULL
    WHEN status='CLOSED' THEN GREATEST(start_date,COALESCE(DATE(closed_at),DATE_SUB(CURDATE(),INTERVAL 1 DAY)))
    ELSE GREATEST(start_date,DATE_SUB(CURDATE(),INTERVAL 1 DAY))
  END
FROM classes;

CREATE TABLE enrollment_active_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  active_from DATE NOT NULL,
  active_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_enrollment_active_period_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT fk_enrollment_active_period_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_enrollment_active_period_dates CHECK (active_to IS NULL OR active_to>=active_from),
  UNIQUE KEY uq_enrollment_active_period_start (enrollment_id,active_from),
  INDEX idx_enrollment_active_period_effective (enrollment_id,active_from,active_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO enrollment_active_periods(enrollment_id,active_from,active_to)
SELECT id,joined_at,
  CASE
    WHEN status='ACTIVE' THEN NULL
    WHEN status='ENDED' THEN GREATEST(joined_at,COALESCE(ended_at,joined_at))
    ELSE GREATEST(joined_at,DATE_SUB(CURDATE(),INTERVAL 1 DAY))
  END
FROM class_enrollments;

CREATE TABLE lesson_makeup_replacements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_occurrence_key VARCHAR(160) NOT NULL,
  makeup_lesson_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_makeup_replacement_lesson FOREIGN KEY (makeup_lesson_id) REFERENCES lesson_sessions(id),
  CONSTRAINT fk_makeup_replacement_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT fk_makeup_replacement_actor FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_makeup_source_enrollment (source_occurrence_key,enrollment_id),
  UNIQUE KEY uq_makeup_lesson_enrollment (makeup_lesson_id,enrollment_id),
  INDEX idx_makeup_replacement_lesson (makeup_lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
