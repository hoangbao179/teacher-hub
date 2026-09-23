# Lesson recording

Dashboard **Hôm nay** tạo/reuse draft theo occurrence rồi mở Simple Mode. Participant
snapshot là nguồn danh sách học sinh; mọi em mặc định `PRESENT`, cô chỉ chuyển em
vắng sang `ABSENT`. Nội dung, homework, general comment và student note đều tùy chọn.

Completion lưu attendance và lesson atomically, audit rồi enqueue Google Sheet
outbox trong cùng transaction. Google worker chạy sau commit. Không có tuition-cycle
recalculation hoặc Google API call trong transaction.

Runtime request/response và database chỉ dùng `PRESENT|ABSENT`. Miễn học phí là cờ
`tuitionExempt` của enrollment và không làm thay đổi attendance.

Full editor vẫn dành cho buổi ngoài lịch, học thêm, học bù, combined class hoặc sửa
metadata. Idempotent replay của lesson `COMPLETED` không tạo attendance/outbox trùng.
