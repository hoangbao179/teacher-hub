ALTER TABLE schedule_exceptions
  ADD COLUMN replacement_cancelled_at DATETIME NULL AFTER replacement_end_time,
  ADD COLUMN replacement_cancelled_by BIGINT UNSIGNED NULL AFTER replacement_cancelled_at,
  ADD COLUMN replacement_cancel_reason VARCHAR(255) NULL AFTER replacement_cancelled_by,
  ADD COLUMN replacement_cancel_note TEXT NULL AFTER replacement_cancel_reason,
  ADD COLUMN makeup_required BOOLEAN NOT NULL DEFAULT TRUE AFTER replacement_cancel_note,
  ADD CONSTRAINT fk_schedule_replacement_cancel_actor
    FOREIGN KEY (replacement_cancelled_by) REFERENCES users(id);

ALTER TABLE lesson_makeup_replacements
  MODIFY makeup_lesson_id BIGINT UNSIGNED NULL,
  ADD COLUMN student_name_snapshot VARCHAR(150) NULL AFTER enrollment_id,
  ADD COLUMN student_nickname_snapshot VARCHAR(100) NULL AFTER student_name_snapshot,
  ADD COLUMN status ENUM('OPEN','RESERVED','FULFILLED','WAIVED') NOT NULL DEFAULT 'OPEN' AFTER student_nickname_snapshot,
  ADD COLUMN reserved_at DATETIME NULL AFTER status,
  ADD COLUMN fulfilled_at DATETIME NULL AFTER reserved_at,
  ADD COLUMN waived_at DATETIME NULL AFTER fulfilled_at,
  ADD COLUMN waived_reason VARCHAR(255) NULL AFTER waived_at,
  ADD COLUMN updated_by BIGINT UNSIGNED NULL AFTER created_by,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD CONSTRAINT fk_makeup_replacement_updated_actor FOREIGN KEY (updated_by) REFERENCES users(id);

UPDATE lesson_makeup_replacements mr
JOIN class_enrollments e ON e.id=mr.enrollment_id
JOIN students s ON s.id=e.student_id
LEFT JOIN lesson_sessions l ON l.id=mr.makeup_lesson_id
LEFT JOIN lesson_attendances a
  ON a.lesson_session_id=l.id AND a.enrollment_id=mr.enrollment_id
SET mr.student_name_snapshot=s.full_name,
    mr.student_nickname_snapshot=s.nickname,
    mr.status=CASE
      WHEN l.status='DRAFT' THEN 'RESERVED'
      WHEN l.status='COMPLETED' AND a.attendance_status IN ('PRESENT','FREE') THEN 'FULFILLED'
      ELSE 'OPEN'
    END,
    mr.reserved_at=CASE WHEN l.status='DRAFT' THEN mr.created_at ELSE NULL END,
    mr.fulfilled_at=CASE
      WHEN l.status='COMPLETED' AND a.attendance_status IN ('PRESENT','FREE') THEN l.completed_at
      ELSE NULL
    END,
    mr.makeup_lesson_id=CASE
      WHEN l.status='DRAFT' OR (l.status='COMPLETED' AND a.attendance_status IN ('PRESENT','FREE')) THEN mr.makeup_lesson_id
      ELSE NULL
    END;

CREATE TABLE tuition_receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  receipt_type ENUM('ADVANCE') NOT NULL DEFAULT 'ADVANCE',
  amount BIGINT UNSIGNED NOT NULL,
  package_price_snapshot BIGINT UNSIGNED NOT NULL,
  received_at DATE NOT NULL,
  payment_method ENUM('CASH','BANK_TRANSFER') NOT NULL,
  status ENUM('AVAILABLE','ALLOCATED','TRANSFERRED','REFUNDED','VOID') NOT NULL DEFAULT 'AVAILABLE',
  note TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tuition_receipt_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT fk_tuition_receipt_actor FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_tuition_receipt_amount CHECK (amount>0 AND amount=package_price_snapshot),
  INDEX idx_tuition_receipt_enrollment_status (enrollment_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tuition_receipt_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT UNSIGNED NOT NULL,
  tuition_cycle_id BIGINT UNSIGNED NOT NULL,
  allocated_amount BIGINT UNSIGNED NOT NULL,
  allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_receipt_allocation_receipt FOREIGN KEY (receipt_id) REFERENCES tuition_receipts(id),
  CONSTRAINT fk_receipt_allocation_cycle FOREIGN KEY (tuition_cycle_id) REFERENCES tuition_cycles(id),
  CONSTRAINT chk_receipt_allocation_amount CHECK (allocated_amount>0),
  UNIQUE KEY uq_receipt_allocation_receipt (receipt_id),
  UNIQUE KEY uq_receipt_allocation_cycle (tuition_cycle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tuition_cycles
  ADD COLUMN settlement_status ENUM('OPEN','SETTLED','WAIVED') NOT NULL DEFAULT 'OPEN' AFTER payment_note,
  ADD COLUMN settled_amount BIGINT UNSIGNED NULL AFTER settlement_status,
  ADD COLUMN settled_at DATETIME NULL AFTER settled_amount,
  ADD COLUMN settlement_method ENUM('CASH','BANK_TRANSFER') NULL AFTER settled_at,
  ADD COLUMN settlement_reason VARCHAR(255) NULL AFTER settlement_method,
  ADD COLUMN settlement_note TEXT NULL AFTER settlement_reason,
  ADD COLUMN settled_by BIGINT UNSIGNED NULL AFTER settlement_note,
  ADD CONSTRAINT fk_tuition_cycle_settled_actor FOREIGN KEY (settled_by) REFERENCES users(id),
  ADD CONSTRAINT chk_tuition_cycle_settlement CHECK (
    (settlement_status='OPEN' AND settled_amount IS NULL AND settled_at IS NULL)
    OR (settlement_status='SETTLED' AND settled_amount IS NOT NULL AND settled_at IS NOT NULL AND settlement_method IS NOT NULL)
    OR (settlement_status='WAIVED' AND settled_at IS NOT NULL AND settlement_reason IS NOT NULL)
  );
