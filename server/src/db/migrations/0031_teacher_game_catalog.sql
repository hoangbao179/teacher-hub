-- Separate a teacher's lesson catalog from assignment delivery/audience.
-- NULL means older or reusable lessons not tied to one specific class.
ALTER TABLE learning_assignments
  ADD COLUMN teaching_class_id BIGINT UNSIGNED NULL AFTER class_id,
  ADD COLUMN textbook_name VARCHAR(120) NULL AFTER title,
  ADD COLUMN lesson_name VARCHAR(120) NULL AFTER textbook_name,
  ADD CONSTRAINT fk_learning_assignments_teaching_class
    FOREIGN KEY (teaching_class_id) REFERENCES classes(id) ON DELETE SET NULL,
  ADD INDEX idx_learning_assignments_teaching_class (teacher_user_id,teaching_class_id,updated_at);
