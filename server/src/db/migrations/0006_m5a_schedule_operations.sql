ALTER TABLE schedule_exceptions
  DROP INDEX uq_class_original_date,
  ADD COLUMN recurring_schedule_id BIGINT UNSIGNED NULL AFTER class_id,
  ADD COLUMN original_start_time TIME NULL AFTER original_date,
  ADD COLUMN original_end_time TIME NULL AFTER original_start_time,
  ADD COLUMN note TEXT NULL AFTER reason,
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER note,
  ADD CONSTRAINT fk_schedule_exception_schedule
    FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id),
  ADD CONSTRAINT fk_schedule_exception_actor
    FOREIGN KEY (created_by) REFERENCES users(id),
  ADD UNIQUE KEY uq_schedule_occurrence_exception (recurring_schedule_id,original_date),
  ADD INDEX idx_schedule_exception_class_date (class_id,original_date);

UPDATE schedule_exceptions se
SET recurring_schedule_id=(
  SELECT MIN(rs.id) FROM recurring_schedules rs
  WHERE rs.class_id=se.class_id
    AND rs.day_of_week=WEEKDAY(se.original_date)+1
    AND rs.effective_from<=se.original_date
    AND (rs.effective_to IS NULL OR rs.effective_to>=se.original_date)
);

UPDATE schedule_exceptions se
JOIN recurring_schedules rs ON rs.id=se.recurring_schedule_id
SET se.original_start_time=rs.start_time,
    se.original_end_time=rs.end_time
WHERE se.original_start_time IS NULL OR se.original_end_time IS NULL;

ALTER TABLE lesson_sessions
  ADD COLUMN source_occurrence_key VARCHAR(160) NULL AFTER class_id,
  ADD UNIQUE KEY uq_lesson_source_occurrence (source_occurrence_key);

ALTER TABLE teacher_busy_slots
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER note,
  ADD CONSTRAINT fk_busy_slot_actor FOREIGN KEY (created_by) REFERENCES users(id);
