# Backend architecture

Express tuân theo controller → service → repository:

- controller parse HTTP/auth/status;
- service giữ validation, business rule và transaction orchestration;
- repository giữ SQL và row mapping.

Lesson completion lưu lesson/attendance và enqueue Google Sheet event trong cùng
transaction; không gọi Google API trong transaction. Monthly tuition service dựng
board từ completed lesson/participant snapshot và transactionally upsert payment/audit.
Không có orchestration cycle/receipt hoặc Legacy Import trong runtime.

Shared DTO chỉ import từ `@teacher/shared`. Mutation nhiều bảng bắt buộc dùng
transaction; external API phải nằm ngoài consistency boundary database.
