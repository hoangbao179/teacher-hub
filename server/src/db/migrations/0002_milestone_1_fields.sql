ALTER TABLE classes
  ADD COLUMN note TEXT NULL AFTER closed_at;

ALTER TABLE class_enrollments
  ADD COLUMN tuition_effective_from DATE NULL AFTER custom_package_price,
  ADD COLUMN note TEXT NULL AFTER end_reason,
  ADD CONSTRAINT chk_enrollment_tuition_price CHECK (
    (tuition_mode = 'CUSTOM' AND custom_package_price IS NOT NULL AND custom_package_price > 0)
    OR (tuition_mode <> 'CUSTOM' AND custom_package_price IS NULL)
  );
