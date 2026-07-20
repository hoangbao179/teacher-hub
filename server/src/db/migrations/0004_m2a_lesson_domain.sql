CREATE TABLE class_tuition_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  package_price BIGINT UNSIGNED NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_class_policy_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_class_policy_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_class_policy_price CHECK (package_price > 0),
  CONSTRAINT chk_class_policy_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE KEY uq_class_policy_start (class_id, effective_from),
  INDEX idx_class_policy_effective (class_id, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO class_tuition_policies(class_id,package_price,effective_from)
SELECT id,default_package_price,start_date FROM classes;

CREATE TABLE enrollment_tuition_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  tuition_mode ENUM('CLASS_DEFAULT','CUSTOM','FREE') NOT NULL,
  custom_package_price BIGINT UNSIGNED NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_enrollment_policy_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT fk_enrollment_policy_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_enrollment_policy_price CHECK (
    (tuition_mode='CUSTOM' AND custom_package_price IS NOT NULL AND custom_package_price > 0)
    OR (tuition_mode<>'CUSTOM' AND custom_package_price IS NULL)
  ),
  CONSTRAINT chk_enrollment_policy_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE KEY uq_enrollment_policy_start (enrollment_id, effective_from),
  INDEX idx_enrollment_policy_effective (enrollment_id, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO enrollment_tuition_policies(enrollment_id,tuition_mode,custom_package_price,effective_from)
SELECT id,tuition_mode,custom_package_price,COALESCE(tuition_effective_from,joined_at)
FROM class_enrollments;

CREATE TABLE lesson_session_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_session_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_participant_lesson FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id),
  CONSTRAINT fk_participant_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT fk_participant_actor FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uq_lesson_participant_enrollment (lesson_session_id,enrollment_id),
  UNIQUE KEY uq_participant_identity (id,enrollment_id,lesson_session_id),
  INDEX idx_participant_enrollment (enrollment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO lesson_session_participants(lesson_session_id,enrollment_id)
SELECT l.id,e.id
FROM lesson_sessions l
JOIN class_enrollments e ON e.class_id=l.class_id
WHERE l.lesson_type='REGULAR'
  AND e.joined_at<=l.session_date
  AND (e.ended_at IS NULL OR e.ended_at>=l.session_date);

INSERT IGNORE INTO lesson_session_participants(lesson_session_id,enrollment_id)
SELECT lesson_session_id,enrollment_id FROM lesson_attendances;

ALTER TABLE lesson_attendances
  ADD COLUMN participant_id BIGINT UNSIGNED NULL AFTER lesson_session_id;

UPDATE lesson_attendances a
JOIN lesson_session_participants p
  ON p.lesson_session_id=a.lesson_session_id AND p.enrollment_id=a.enrollment_id
SET a.participant_id=p.id;

ALTER TABLE lesson_attendances
  MODIFY participant_id BIGINT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_attendance_participant_identity
    FOREIGN KEY (participant_id,enrollment_id,lesson_session_id)
    REFERENCES lesson_session_participants(id,enrollment_id,lesson_session_id),
  ADD UNIQUE KEY uq_attendance_participant (participant_id),
  ADD CONSTRAINT chk_attendance_billable_status CHECK (
    counts_for_tuition=0 OR attendance_status='PRESENT'
  );

ALTER TABLE tuition_cycles
  ADD CONSTRAINT chk_cycle_target_eight CHECK (target_session_count=8),
  ADD CONSTRAINT chk_cycle_positive_price CHECK (package_price_snapshot>0);

ALTER TABLE tuition_cycle_sessions
  ADD CONSTRAINT chk_cycle_sequence CHECK (sequence_number BETWEEN 1 AND 8);
