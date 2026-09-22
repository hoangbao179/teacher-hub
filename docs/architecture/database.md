# Database architecture

Quan hệ runtime chính:

```text
classes ─ recurring_schedules ─ schedule_exceptions
classes ─ class_enrollments ─ students
classes ─ lesson_sessions ─ lesson_session_participants ─ lesson_attendances
class_enrollments ─ monthly_tuition_payments
students ─ student_google_sheets
lesson_sessions/students ─ google_sheet_sync_outbox
```

`monthly_tuition_payments` unique theo enrollment/year/month, month 1–12 và yêu cầu
`paid_at` khi status `PAID`. Attendance summary không denormalize vào payment row;
repository query lesson `COMPLETED` cùng participant snapshot.

Participant unique theo lesson/enrollment và attendance tham chiếu đúng snapshot.
Generated active-student key bảo vệ một enrollment `ACTIVE` cho mỗi student. MySQL
pool dùng `dateStrings: true` để `DATE` không bị lệch timezone.

Các bảng tuition cycle, receipt, policy và legacy import vẫn tồn tại như historical
schema vì migration đã áp dụng không được sửa/drop. Runtime hiện hành không đọc/ghi
chúng. Một cleanup/backfill vật lý cần task riêng, backup và rule mapping được duyệt.

Tiền dùng integer VND, duration dùng phút nguyên, ngày `DATE`, giờ `TIME`; UI dùng
`Asia/Ho_Chi_Minh`.
