# 09. Acceptance tests

1. Participant mặc định Có mặt; đổi một em sang Nghỉ và để trống mọi comment vẫn
   hoàn tất được lesson.
2. Attendance chỉ chấp nhận `PRESENT|ABSENT`; miễn học phí không đổi attendance.
3. Tháng có 6 present, 2 absent trả `present=6`, `absent=2`, `total=8`.
4. Một tháng có 8 occurrence hợp lệ nhưng mới completed 3 buổi vẫn trả denominator 8;
   occurrence skip, bản gốc rescheduled và replacement bị hủy không tăng denominator.
5. Học bù chỉ tăng cho participant snapshot được chọn; combined class dùng lesson
   con canonical và không nhân đôi.
6. Enrollment `tuitionExempt=true` không xuất hiện trên board và không tạo payment.
7. Mark paid tạo một record/audit; replay cùng payload idempotent; payload khác trên
   record PAID bị chặn; request sai student/enrollment/month trả lỗi và không ghi DB.
8. Month navigation qua biên năm giữ year/month hợp lệ theo giờ Việt Nam.
9. Chuyển/ngừng học giữ lịch sử lesson và payment tháng.
10. Google Sheet có một tab hiển thị dễ đọc, ẩn metadata kỹ thuật; sửa cùng lesson
    cập nhật cùng row, append giữ format và `Cập nhật gần nhất` đổi sau mỗi sync.
11. Export XLSX chỉ có sheet quá trình học tập, vô hiệu hóa formula injection.
12. Legacy Import và cycle/receipt/policy schema/runtime không còn tồn tại.
13. Combined class, external schedule, busy slot, reschedule và cancellation giữ
    behavior hiện hành.
