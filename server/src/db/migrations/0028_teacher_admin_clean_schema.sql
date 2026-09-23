ALTER TABLE student_google_sheets
  DROP FOREIGN KEY fk_student_google_sheet_import,
  DROP COLUMN legacy_import_id,
  DROP COLUMN source_import_sha256;

DROP TABLE legacy_import_lesson_links;
DROP TABLE legacy_import_row_audits;
DROP TABLE legacy_imports;

DROP TABLE tuition_receipt_allocations;
DROP TABLE tuition_receipts;
DROP TABLE tuition_cycle_sessions;
DROP TABLE tuition_cycles;

DROP TABLE enrollment_tuition_policies;
DROP TABLE class_tuition_policies;

ALTER TABLE classes
  DROP COLUMN default_package_price;

ALTER TABLE class_enrollments
  DROP CHECK chk_enrollment_tuition_price,
  ADD COLUMN tuition_exempt BOOLEAN NOT NULL DEFAULT FALSE AFTER ended_at,
  DROP COLUMN tuition_mode,
  DROP COLUMN custom_package_price,
  DROP COLUMN tuition_effective_from;

ALTER TABLE lesson_attendances
  ADD INDEX idx_attendance_enrollment (enrollment_id);

ALTER TABLE lesson_attendances
  DROP CHECK chk_attendance_billable_status,
  DROP CHECK chk_attendance_manual_exclusion,
  DROP INDEX idx_attendance_enrollment_billable,
  DROP INDEX idx_attendance_recalculation,
  MODIFY attendance_status ENUM('PRESENT','ABSENT') NOT NULL,
  DROP COLUMN counts_for_tuition,
  DROP COLUMN excluded_from_tuition;

ALTER TABLE monthly_tuition_payments
  DROP CHECK chk_monthly_tuition_paid,
  DROP INDEX idx_monthly_tuition_period_status,
  DROP COLUMN status,
  ADD INDEX idx_monthly_tuition_period (tuition_year,tuition_month);
