CREATE TABLE teacher_busy_slot_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_busy_slot_id BIGINT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_busy_slot_schedule_parent FOREIGN KEY (teacher_busy_slot_id)
    REFERENCES teacher_busy_slots(id) ON DELETE CASCADE,
  CONSTRAINT chk_busy_slot_schedule_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_busy_slot_schedule_time CHECK (end_time > start_time),
  UNIQUE KEY uq_busy_slot_schedule_start (teacher_busy_slot_id,day_of_week,start_time),
  KEY idx_busy_slot_schedule_day_time (day_of_week,start_time,end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO teacher_busy_slot_schedules
  (teacher_busy_slot_id,day_of_week,start_time,end_time,display_order)
SELECT id,day_of_week,start_time,end_time,0
FROM teacher_busy_slots
WHERE recurrence_type='WEEKLY'
  AND day_of_week IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL;

ALTER TABLE teacher_busy_slots
  MODIFY COLUMN start_time TIME NULL,
  MODIFY COLUMN end_time TIME NULL;
