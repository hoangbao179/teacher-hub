# Lesson recording

## Flow

1. Tạo `lesson_sessions` trạng thái `DRAFT`.
2. Nhập actual time, content, homework và attendance.
3. `LessonService.complete` khóa lesson và active enrollments trong transaction.
4. Mỗi enrollment phải có đúng một attendance.
5. `PRESENT` của học sinh trả phí tạo/cộng cycle item.
6. `ABSENT`, `FREE` và enrollment miễn phí không cộng.
7. Item thứ 8 chuyển cycle sang `PAYMENT_DUE`.

Giờ thực tế không đổi số buổi. Nhập muộn phải dùng `session_date` để xử lý; feature tái phân bổ khi sửa dữ liệu cũ là milestone riêng.
