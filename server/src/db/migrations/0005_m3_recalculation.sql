ALTER TABLE lesson_attendances
  ADD COLUMN excluded_from_tuition BOOLEAN NOT NULL DEFAULT FALSE AFTER counts_for_tuition,
  ADD INDEX idx_attendance_recalculation (enrollment_id,excluded_from_tuition,attendance_status);

ALTER TABLE lesson_attendances
  ADD CONSTRAINT chk_attendance_manual_exclusion CHECK (
    excluded_from_tuition=0 OR counts_for_tuition=0
  );
