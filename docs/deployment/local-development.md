# Local development

Yêu cầu Node 24.18.x, npm 12.x, MySQL 8 và timezone `Asia/Ho_Chi_Minh`.
Sao chép `server/.env.example`/`client/.env.example`, tạo database utf8mb4,
chạy `npm ci`, `npm run db:migrate`, `npm run db:bootstrap-admin`, tùy chọn
`npm run db:seed:dev`, rồi `npm run dev`.

Seed chỉ chứa tên/số điện thoại giả, idempotent và bị từ chối khi
`NODE_ENV=production`. `db:reset:dev` là lệnh phá hủy dữ liệu dev và không được
dùng với database cần giữ. Trước checkpoint dùng `npm run check:fast`; trước
release dùng `npm run check:full` với MySQL đang chạy.
