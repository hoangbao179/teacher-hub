# Backend architecture

Controller chỉ xử lý HTTP. Service xử lý business rule và transaction. Repository chứa SQL.

Transaction bắt buộc cho:

- hoàn thành buổi học + điểm danh + phân bổ chu kỳ;
- sửa attendance ảnh hưởng chu kỳ;
- đóng enrollment có chu kỳ dang dở;
- mở khóa chu kỳ đã thu trong tương lai.

Business logic không được chuyển sang frontend.

`LessonService.complete` hiện là vertical slice mẫu cho cách triển khai feature.
