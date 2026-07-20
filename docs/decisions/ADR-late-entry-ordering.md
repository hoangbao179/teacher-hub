# ADR: Late-entry ordering

Status: Approved and implemented in Milestone 3.

## Decision

Lesson lịch sử được xử lý theo ngày học thực tế (`session_date`), không theo
`created_at`. Tie-break bắt buộc deterministic: effective actual start
(`actual_start_time` khi có, nếu không dùng `scheduled_start_time`), tiếp theo
`scheduled_start_time`, `lesson_session.id`, rồi `lesson_attendance.id`.

Cycle `PAID` tạo ranh giới bất biến. Hệ thống không tự động tái tính qua ranh
giới đã thanh toán; trường hợp ảnh hưởng vùng sau `PAID` phải dừng, báo conflict
và dùng flow unlock có reason/audit nếu nghiệp vụ sau này cho phép.

Mọi mutable billable attendance phải nằm strict sau ordering key cuối cùng của
vùng `PAID`. Attendance mới/sửa có key bằng hoặc trước boundary trả
`PAID_CYCLE_CONFLICT`; toàn transaction rollback. Chỉ cycles không `PAID` được
xóa và dựng lại thành nhóm 8 theo ordering trên.
