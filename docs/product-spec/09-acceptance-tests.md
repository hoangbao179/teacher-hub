# 09. Acceptance tests

1. Participant mặc định Có mặt; đổi một em sang Nghỉ và để trống mọi comment vẫn
   hoàn tất được lesson.
2. Runtime từ chối attendance `FREE`; lịch sử `FREE` được hiển thị như Có mặt.
3. Tháng có 6 present, 2 absent trả `present=6`, `absent=2`, `total=8`.
4. Lesson draft/cancelled và occurrence skip không tăng summary; lesson đổi lịch
   tính theo ngày thực tế.
5. Học bù chỉ tăng cho participant snapshot được chọn; combined class dùng lesson
   con canonical và không nhân đôi.
6. Enrollment `FREE` không xuất hiện trên board và không tạo monthly payment.
7. Mark paid tạo một record/audit; replay cùng payload idempotent; payload khác trên
   record PAID bị chặn.
8. Month navigation qua biên năm giữ year/month hợp lệ theo giờ Việt Nam.
9. Chuyển/ngừng học giữ lịch sử lesson và payment tháng, không tạo quyết toán cycle.
10. Google Sheet có một tab hiển thị dễ đọc, ẩn metadata kỹ thuật; sửa cùng lesson
    cập nhật cùng row sau retry.
11. Export XLSX chỉ có sheet quá trình học tập, vô hiệu hóa formula injection.
12. Legacy Import route và cycle/receipt route cũ trả 404 sau auth.
13. Combined class, external schedule, busy slot, reschedule và cancellation giữ
    behavior hiện hành.
