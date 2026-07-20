# Base status

## Đã có và đã compile

- npm workspaces `shared/server/client`.
- Shared contracts dual ESM/CJS.
- Express API, JWT auth, MySQL migration runner.
- Schema V1 cho lớp, học sinh, enrollment, lịch, buổi học, attendance, chu kỳ học phí và audit log.
- Vertical slice `LessonService.complete`: hoàn thành buổi, điểm danh, tạo/cộng cycle, đủ 8 chuyển `PAYMENT_DUE`.
- API list/detail/create nền cho classes/students/lessons/tuition/schedule/dashboard.
- React mobile-first shell và các trang chính.
- Docker, Nginx, CI, AGENTS và Cursor rules.
- Product spec + 18 wireframe P0.

## Chưa hoàn thiện, không được hiểu nhầm là đã production-ready

- Form CRUD lớp/học sinh đầy đủ.
- Wizard điểm danh/nội dung/confirm phía frontend.
- Sửa attendance cũ và tái phân bổ cycle theo chronological order.
- Đóng/tạm dừng lớp, ngừng học và cycle `INCOMPLETE`.
- Schedule exception/reschedule/bulk reconciliation UI đầy đủ.
- Mark-paid form frontend và flow mở khóa cycle đã paid.
- Excel export/import.
- Rate limit login, backup automation, production monitoring.
- Automated test suite.

Xem `docs/implementation/milestones.md` trước khi tiếp tục.
