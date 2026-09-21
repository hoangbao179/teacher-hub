CREATE TABLE monthly_tuition_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  tuition_year SMALLINT UNSIGNED NOT NULL,
  tuition_month TINYINT UNSIGNED NOT NULL,
  status ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
  amount BIGINT UNSIGNED NULL,
  paid_at DATETIME NULL,
  note VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_monthly_tuition_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT chk_monthly_tuition_month CHECK (tuition_month BETWEEN 1 AND 12),
  CONSTRAINT chk_monthly_tuition_paid CHECK (status='UNPAID' OR paid_at IS NOT NULL),
  UNIQUE KEY uq_monthly_tuition_enrollment_month (enrollment_id,tuition_year,tuition_month),
  INDEX idx_monthly_tuition_period_status (tuition_year,tuition_month,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
