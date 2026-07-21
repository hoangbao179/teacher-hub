# 07. Domain Model and Data Dictionary

## User
- id, username (unique), email (legacy/optional), passwordHash, status, lastLoginAt.

## Student
- id, fullName, nickname, dateOfBirth (optional), gender (optional), parentName, parentPhone, note, status, createdAt, updatedAt.

## Class
- id, name, classType, subject, level, defaultPackagePrice, defaultSessionDurationMinutes, startDate, expectedEndDate, status, note.

## ClassEnrollment
- id, classId, studentId, joinedAt, endedAt, status, tuitionMode, customPackagePrice, tuitionEffectiveFrom, note.
- Constraint: một student chỉ có tối đa một enrollment ACTIVE.

## RecurringSchedule
- id, classId, dayOfWeek, scheduledStartTime, scheduledEndTime, effectiveFrom, effectiveTo.

## ScheduleException
- id, classId, recurringScheduleId, originalDate, originalStartTime,
  originalEndTime, type (`SKIPPED`/`RESCHEDULED`), replacementDate,
  replacementStartTime, replacementEndTime, reason, note, createdBy, createdAt.
- Unique: recurringScheduleId + originalDate. Exception chỉ xử lý một occurrence
  và không sửa định nghĩa lịch lặp.

## TeacherBusySlot
- id, title, recurrenceType, dayOfWeek/specificDate, startTime, endTime,
  effectiveFrom, effectiveTo, location, note, createdBy, createdAt, updatedAt.
- Không có student, enrollment, attendance hoặc tuition behavior.

## LessonSession
- id, classId, sourceOccurrenceKey (nullable/unique), lessonDate,
  scheduledStartTime, scheduledEndTime, actualStartTime, actualEndTime,
  actualDurationMinutes, sessionType, content, homework, note, status, createdAt,
  updatedAt.

## LessonAttendance
- id, sessionId, participantId, enrollmentId, attendanceStatus,
  countsForTuition, excludedFromTuition, studentNote, createdAt, updatedAt.
- Unique: participantId và sessionId + enrollmentId; composite foreign key bảo
  đảm attendance thuộc đúng participant snapshot.
- `excludedFromTuition=true` là manual approved exclusion và bắt buộc
  `countsForTuition=false`.

## LessonSessionParticipant
- id, lessonSessionId, enrollmentId, createdAt, createdBy.
- Unique: lessonSessionId + enrollmentId.

## ClassTuitionPolicy
- id, classId, packagePrice, effectiveFrom, effectiveTo, createdAt, createdBy.
- Khoảng ngày inclusive, không overlap; packagePrice là integer VND dương.

## EnrollmentTuitionPolicy
- id, enrollmentId, tuitionMode, customPackagePrice, effectiveFrom, effectiveTo,
  createdAt, createdBy.
- Khoảng ngày inclusive, không overlap; `CUSTOM` có giá dương, `FREE` và
  `CLASS_DEFAULT` không có custom price.

## TuitionCycle
- id, enrollmentId, cycleNumber, targetCount=8, packagePriceSnapshot, status, startedAt, reachedTargetAt, paidAt, paidAmount, paymentMethod, paymentNote, lockReason.
- `paidAt` là ngày thu trong V1; `paidAmount` phải bằng `packagePriceSnapshot`.
- `paymentMethod`: `CASH` hoặc `BANK_TRANSFER`; không có partial payment.
- Chỉ partial cycle của enrollment `ENDED` có trạng thái `INCOMPLETE`.

## TuitionCycleSession
- id, tuitionCycleId, attendanceId, sequenceNumber 1..8.
- Unique attendanceId; unique cycleId + sequenceNumber.

## AuditLog
- id, actorUserId, entityType, entityId, action, reason, beforeJson, afterJson, createdAt.
- Tuition actions hiện hành: `TUITION_ALLOCATION_RECALCULATED`,
  `TUITION_CYCLE_CREATED`, `TUITION_CYCLE_PAYMENT_DUE`,
  `TUITION_CYCLE_MARKED_PAID`.
- `TUITION_CYCLE_MARKED_PAID` được ghi cùng transaction với payment fields;
  replay đồng nhất không tạo audit thứ hai.
- Schedule actions hiện hành: `SCHEDULE_OCCURRENCE_SKIPPED`,
  `SCHEDULE_OCCURRENCE_RESCHEDULED`, `TEACHER_BUSY_SLOT_CREATED`,
  `TEACHER_BUSY_SLOT_UPDATED`, `TEACHER_BUSY_SLOT_DELETED` và các mutation
  `RECURRING_SCHEDULE_*`. Replay exception đồng nhất không tạo audit thứ hai.
- Report action: `STUDENT_REPORT_EXPORTED`, entity là `STUDENT`; `after_json`
  chỉ lưu filters đã dùng. Workbook bytes không được lưu trong audit/database.

## Kiểu dữ liệu bắt buộc
- Múi giờ ứng dụng: Asia/Ho_Chi_Minh.
- Tiền: integer VND.
- Duration: integer minutes.
- Ngày hiển thị: dd/MM/yyyy.
- Không cho session đi qua nửa đêm trong V1.
