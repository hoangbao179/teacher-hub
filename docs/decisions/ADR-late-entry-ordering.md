# ADR: Late-entry ordering

Status: Approved for Milestone 3 recalculation design; chưa triển khai.

## Decision

Lesson lịch sử được xử lý theo ngày học thực tế (`session_date`), không theo
`created_at`. Tie-break bắt buộc deterministic: `scheduled_start_time`, sau đó
`lesson_session.id`, rồi `lesson_attendance.id`.

Cycle `PAID` tạo ranh giới bất biến. Hệ thống không tự động tái tính qua ranh
giới đã thanh toán; trường hợp ảnh hưởng vùng sau `PAID` phải dừng, báo conflict
và dùng flow unlock có reason/audit nếu nghiệp vụ sau này cho phép.
