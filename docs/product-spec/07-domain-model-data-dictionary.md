# 07. Domain Model and Data Dictionary

## User
- id, username/email, passwordHash, status, lastLoginAt.

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
- id, classId, occurrenceDate, type (`SKIPPED`/`RESCHEDULED`), newDate, newStartTime, newEndTime, reason.

## TeacherBusySlot
- id, title, recurrenceType, dayOfWeek/date, startTime, endTime, effectiveFrom, effectiveTo, location, note.

## LessonSession
- id, classId, lessonDate, scheduledStartTime, scheduledEndTime, actualStartTime, actualEndTime, actualDurationMinutes, sessionType, content, homework, note, status, createdAt, updatedAt.

## LessonAttendance
- id, sessionId, enrollmentId, attendanceStatus, billingType, studentNote, createdAt, updatedAt.
- Unique: sessionId + enrollmentId.

## TuitionCycle
- id, enrollmentId, cycleNumber, targetCount=8, packagePriceSnapshot, status, startedAt, reachedTargetAt, paidAt, paidAmount, paymentMethod, paymentNote, lockReason.

## TuitionCycleSession
- id, tuitionCycleId, attendanceId, sequenceNumber 1..8.
- Unique attendanceId; unique cycleId + sequenceNumber.

## Kiểu dữ liệu bắt buộc
- Múi giờ ứng dụng: Asia/Ho_Chi_Minh.
- Tiền: integer VND.
- Duration: integer minutes.
- Ngày hiển thị: dd/MM/yyyy.
- Không cho session đi qua nửa đêm trong V1.
