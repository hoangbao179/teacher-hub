# 07. Domain model and data dictionary

## Core

- `Student`: id, fullName, nickname, ngày sinh/giới tính tùy chọn, liên hệ phụ huynh,
  note, status, timestamps.
- `Class`: id, name, classType, subject, defaultDurationMinutes, start/end/status,
  note. `defaultPackagePrice` còn là cột tương thích lịch sử, không định giá tháng.
- `ClassEnrollment`: id, classId, studentId, joinedAt, endedAt, status, tuitionMode,
  customPackagePrice, note. `FREE` loại khỏi bảng học phí tháng; `CUSTOM` và policy
  cũ được giữ để tương thích dữ liệu.
- `RecurringSchedule`, `ScheduleException`, `TeacherBusySlot` và combined group giữ
  mô hình hiệu lực hiện hành.

## Lesson

- `LessonSession`: classId, participant source, ngày, giờ dự kiến/thực tế, duration,
  type, content/homework/generalComment/note, status và timestamps.
- `LessonSessionParticipant`: snapshot unique theo lesson + enrollment.
- `LessonAttendance`: participantId, enrollmentId, `PRESENT|ABSENT` cho runtime,
  studentNote. Các cột billing và giá trị `FREE` cũ chỉ phục vụ tương thích lịch sử.

## MonthlyTuitionPayment

- id, enrollmentId, tuitionYear, tuitionMonth, `UNPAID|PAID`, amount nullable,
  paidAt, note, createdAt, updatedAt.
- Unique `(enrollmentId, tuitionYear, tuitionMonth)`; month 1–12; `PAID` bắt buộc
  có `paidAt`; amount nếu có là integer VND không âm.
- Student/class được resolve qua enrollment. Summary attendance được query từ
  completed lesson + participant snapshot, không lưu trùng trong payment row.

## Historical-only tables

`tuition_cycles`, cycle items, receipts, allocations, tuition policies và legacy
import tables vẫn tồn tại vì không được xóa dữ liệu/migration đã áp dụng. Runtime
hiện hành không đọc/ghi các bảng này.

## AuditLog

Mutation payment tháng ghi `MONTHLY_TUITION_MARKED_PAID` cùng transaction. Export
ghi `STUDENT_REPORT_EXPORTED`. Workbook bytes, token và credential không vào audit.

## Kiểu dữ liệu

Timezone `Asia/Ho_Chi_Minh`; tiền integer VND; duration integer minutes; ngày `DATE`;
giờ `TIME`; hiển thị ngày `dd/MM/yyyy`.
