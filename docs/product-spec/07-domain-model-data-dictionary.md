# 07. Domain model and data dictionary

## Core

- `Student`: id, fullName, nickname, ngày sinh/giới tính tùy chọn, liên hệ phụ huynh,
  note, status, timestamps.
- `Class`: id, name, classType, subject, defaultDurationMinutes, start/end/status, note.
- `ClassEnrollment`: id, classId, studentId, joinedAt, endedAt, status,
  `tuitionExempt`, note. Enrollment miễn học phí bị loại khỏi board/payment tháng.
- `RecurringSchedule`, `ScheduleException`, `TeacherBusySlot` và combined group giữ
  mô hình hiệu lực hiện hành.

## Lesson

- `LessonSession`: classId, participant source, ngày, giờ dự kiến/thực tế, duration,
  type, content/homework/generalComment/note, status và timestamps.
- `LessonSessionParticipant`: snapshot unique theo lesson + enrollment.
- `LessonAttendance`: participantId, enrollmentId, `PRESENT|ABSENT`, studentNote.

## MonthlyTuitionPayment

- id, enrollmentId, tuitionYear, tuitionMonth, amount nullable, paidAt, note,
  createdAt, updatedAt. Không có status column.
- Unique `(enrollmentId, tuitionYear, tuitionMonth)`; month 1–12; amount nếu có là
  integer VND không âm. Không có row là `UNPAID`, có row là `PAID`.
- Student/class được resolve qua enrollment. Summary attendance được query từ
  schedule/lesson projection và attendance, không lưu trùng trong payment row.

## Removed legacy schema

Cleanup migration drop cycle, cycle session, receipt, receipt allocation, class/enrollment
tuition policy và legacy import tables; đồng thời drop các FK/cột legacy liên quan.

## AuditLog

Mutation payment tháng ghi `MONTHLY_TUITION_MARKED_PAID` cùng transaction. Export
ghi `STUDENT_REPORT_EXPORTED`. Workbook bytes, token và credential không vào audit.

## Kiểu dữ liệu

Timezone `Asia/Ho_Chi_Minh`; tiền integer VND; duration integer minutes; ngày `DATE`;
giờ `TIME`; hiển thị ngày `dd/MM/yyyy`.
