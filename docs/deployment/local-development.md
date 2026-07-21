# Local development

Yêu cầu Node 24.18.x, npm 12.x, MySQL 8 và timezone `Asia/Ho_Chi_Minh`.
Sao chép `server/.env.example`/`client/.env.example`, tạo database utf8mb4,
chạy `npm ci`, `npm run db:migrate`, `npm run db:bootstrap-admin`, tùy chọn
`npm run db:seed:dev`, rồi `npm run dev`. Lệnh `npm run dev` không tự chạy
bootstrap: sửa `.env` một mình không đổi mật khẩu trong database.

Mật khẩu admin V1 có mức tối thiểu chủ ý là 6 ký tự qua
`ADMIN_PASSWORD_MIN_LENGTH=6`. Khi hệ thống được public rộng hơn, nên tăng giá
trị này. Để áp dụng credential bootstrap, sửa `BOOTSTRAP_ADMIN_USERNAME` và
`BOOTSTRAP_ADMIN_PASSWORD`, chủ động chạy `npm run db:bootstrap-admin`, rồi kiểm
tra thông báo `Admin ready: <username>`. Để chỉ đổi mật khẩu của admin hiện hữu,
chạy `npm run admin:reset-password`; terminal sẽ ẩn mật khẩu và yêu cầu nhập lại.
Automation deployment có thể truyền đủ `ADMIN_RESET_USERNAME`,
`ADMIN_RESET_PASSWORD`, `ADMIN_RESET_PASSWORD_CONFIRMATION`; command không in
secret và không chấp nhận bộ biến thiếu.

Limiter đăng nhập development mặc định 60 giây/20 lần sai; restart tiến trình API
là cách đơn giản để xóa state in-memory khi phát triển. Có thể chỉnh
`LOGIN_RATE_LIMIT_WINDOW_SECONDS` và `LOGIN_RATE_LIMIT_MAX_FAILURES`, nhưng không
thể đặt 0 để tắt bảo vệ. Nếu cổng web 5173 bị chiếm, Vite sẽ dừng thay vì tự đổi
cổng. Trên Windows, tìm và dừng đúng tiến trình bằng:

```bat
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Seed chỉ chứa tên/số điện thoại giả, idempotent và bị từ chối khi
`NODE_ENV=production`. `db:reset:dev` là lệnh phá hủy dữ liệu dev và không được
dùng với database cần giữ. Trước checkpoint dùng `npm run check:fast`; trước
release dùng `npm run check:full` với MySQL đang chạy.
