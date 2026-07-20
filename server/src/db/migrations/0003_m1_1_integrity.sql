ALTER TABLE classes
  ADD CONSTRAINT chk_classes_positive_package_price CHECK (default_package_price > 0);

ALTER TABLE class_enrollments
  ADD COLUMN active_student_key BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN student_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_enrollments_one_active_per_student (active_student_key);
