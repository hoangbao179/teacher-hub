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

`monthly_tuition_payments` unique theo enrollment/year/month, month 1–12. Bảng không
có status: không có row là `UNPAID`, có row là `PAID`. Attendance summary không
denormalize vào payment row; numerator lấy attendance `PRESENT`, denominator lấy
occurrence hợp lệ từ schedule/lesson projection hiện tại.

Participant unique theo lesson/enrollment và attendance tham chiếu đúng snapshot.
Generated active-student key bảo vệ một enrollment `ACTIVE` cho mỗi student. MySQL
pool dùng `dateStrings: true` để `DATE` không bị lệch timezone.

Migration `0028_teacher_admin_clean_schema.sql` drop tuition cycle/session,
receipt/allocation, class/enrollment tuition policy và legacy import tables. Enrollment
chỉ giữ `tuition_exempt`; attendance chỉ giữ `PRESENT|ABSENT` và không còn billing flags.

Tiền dùng integer VND, duration dùng phút nguyên, ngày `DATE`, giờ `TIME`; UI dùng
`Asia/Ho_Chi_Minh`.
