ALTER TABLE student_google_sheets
  ADD COLUMN generation_started_at DATETIME NULL AFTER source_import_sha256;

UPDATE student_google_sheets
SET generation_started_at=updated_at
WHERE status='CREATING' AND generation_started_at IS NULL;

CREATE TEMPORARY TABLE affected_students (
  student_id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=InnoDB;

INSERT INTO affected_students(student_id)
SELECT DISTINCT e.student_id
FROM lesson_attendances a
JOIN class_enrollments e ON e.id=a.enrollment_id
WHERE a.attendance_status='ABSENT_CHARGED';

CREATE TEMPORARY TABLE mutable_cycle_slots AS
SELECT ranked.*
FROM (
  SELECT tc.id cycle_id,owner.student_id,tc.enrollment_id,tc.cycle_number,
    tc.package_price_snapshot,
    ROW_NUMBER() OVER (PARTITION BY owner.student_id ORDER BY tc.started_at,tc.id) group_number
  FROM tuition_cycles tc
  JOIN class_enrollments owner ON owner.id=tc.enrollment_id
  JOIN affected_students affected ON affected.student_id=owner.student_id
  WHERE tc.status<>'PAID'
) ranked;

ALTER TABLE mutable_cycle_slots
  ADD PRIMARY KEY (cycle_id),
  ADD UNIQUE KEY uq_mutable_student_group (student_id,group_number);

UPDATE tuition_receipts receipt
JOIN tuition_receipt_allocations allocation ON allocation.receipt_id=receipt.id
JOIN mutable_cycle_slots slot ON slot.cycle_id=allocation.tuition_cycle_id
SET receipt.status=IF(receipt.status='TRANSFERRED','TRANSFERRED','AVAILABLE');

DELETE allocation
FROM tuition_receipt_allocations allocation
JOIN mutable_cycle_slots slot ON slot.cycle_id=allocation.tuition_cycle_id;

DELETE item
FROM tuition_cycle_sessions item
JOIN mutable_cycle_slots slot ON slot.cycle_id=item.tuition_cycle_id;

UPDATE lesson_attendances
SET attendance_status='ABSENT',counts_for_tuition=0
WHERE attendance_status='ABSENT_CHARGED';

CREATE TEMPORARY TABLE mutable_present_attendances AS
SELECT ordered.*,
  FLOOR((ordered.row_number_in_student - 1) / 8) + 1 group_number,
  MOD(ordered.row_number_in_student - 1,8) + 1 sequence_number
FROM (
  SELECT a.id attendance_id,a.enrollment_id,e.student_id,l.session_date,
    ROW_NUMBER() OVER (
      PARTITION BY e.student_id
      ORDER BY l.session_date,COALESCE(l.actual_start_time,l.scheduled_start_time),
        l.scheduled_start_time,l.id,a.id
    ) row_number_in_student
  FROM lesson_attendances a
  JOIN class_enrollments e ON e.id=a.enrollment_id
  JOIN affected_students affected ON affected.student_id=e.student_id
  JOIN lesson_sessions l ON l.id=a.lesson_session_id AND l.status='COMPLETED'
  LEFT JOIN tuition_cycle_sessions paid_item ON paid_item.attendance_id=a.id
  LEFT JOIN tuition_cycles paid_cycle
    ON paid_cycle.id=paid_item.tuition_cycle_id AND paid_cycle.status='PAID'
  WHERE a.attendance_status='PRESENT'
    AND a.counts_for_tuition=1
    AND a.excluded_from_tuition=0
    AND paid_cycle.id IS NULL
) ordered;

ALTER TABLE mutable_present_attendances
  ADD PRIMARY KEY (attendance_id),
  ADD KEY idx_mutable_present_group (student_id,group_number,sequence_number);

UPDATE tuition_cycles cycle
JOIN mutable_cycle_slots slot ON slot.cycle_id=cycle.id
JOIN (
  SELECT student_id,group_number,MIN(session_date) started_at,
    IF(COUNT(*)=8,MAX(session_date),NULL) reached_target_at,
    COUNT(*) item_count
  FROM mutable_present_attendances
  GROUP BY student_id,group_number
) rebuilt ON rebuilt.student_id=slot.student_id AND rebuilt.group_number=slot.group_number
SET cycle.started_at=rebuilt.started_at,
    cycle.reached_target_at=rebuilt.reached_target_at,
    cycle.status=CASE
      WHEN rebuilt.item_count=8 THEN 'PAYMENT_DUE'
      WHEN EXISTS(
        SELECT 1 FROM class_enrollments active
        WHERE active.student_id=slot.student_id AND active.status='ACTIVE'
      ) THEN 'ACCUMULATING'
      ELSE 'INCOMPLETE'
    END,
    cycle.settlement_status='OPEN',
    cycle.settled_amount=NULL,
    cycle.settled_at=NULL,
    cycle.settlement_method=NULL,
    cycle.settlement_reason=NULL,
    cycle.settlement_note=NULL,
    cycle.settled_by=NULL;

INSERT INTO tuition_cycle_sessions(tuition_cycle_id,attendance_id,sequence_number)
SELECT slot.cycle_id,attendance.attendance_id,attendance.sequence_number
FROM mutable_present_attendances attendance
JOIN mutable_cycle_slots slot
  ON slot.student_id=attendance.student_id
 AND slot.group_number=attendance.group_number;

DELETE cycle
FROM tuition_cycles cycle
JOIN mutable_cycle_slots slot ON slot.cycle_id=cycle.id
LEFT JOIN mutable_present_attendances attendance
  ON attendance.student_id=slot.student_id
 AND attendance.group_number=slot.group_number
WHERE attendance.attendance_id IS NULL;

ALTER TABLE lesson_attendances
  DROP CHECK chk_attendance_billable_status,
  MODIFY attendance_status ENUM('PRESENT','ABSENT','FREE') NOT NULL,
  ADD CONSTRAINT chk_attendance_billable_status CHECK (
    counts_for_tuition=0 OR attendance_status='PRESENT'
  );

DROP TEMPORARY TABLE mutable_present_attendances;
DROP TEMPORARY TABLE mutable_cycle_slots;
DROP TEMPORARY TABLE affected_students;
