# Production deployment

## Chuẩn bị

- Linux host, Docker Compose, DNS và HTTPS reverse proxy; cấu hình tham chiếu phù
  hợp máy nhỏ khoảng 1 CPU/1 GB RAM/15 GB SSD nhưng chưa được benchmark tại mức đó.
- Tạo secret ngẫu nhiên tối thiểu 32 ký tự; không dùng giá trị `.env.example`.
- Đặt limiter production theo khuyến nghị 300 giây/10 lần sai bằng
  `LOGIN_RATE_LIMIT_WINDOW_SECONDS=300` và `LOGIN_RATE_LIMIT_MAX_FAILURES=10`.
- Đặt `BOOTSTRAP_ADMIN_USERNAME` (3–64 ký tự `a-z`, `0-9`, `.`, `_`, `-`),
  `BOOTSTRAP_ADMIN_PASSWORD` mạnh và tên hiển thị. Email không bắt buộc.
- Đặt `PUBLIC_URL=https://...`, DB credentials riêng, và giữ file env ngoài Git.
- Cấu hình toàn bộ `PUBLIC_*` trong `deploy/env.example`: tên/brand giáo viên,
  điện thoại, Zalo, Facebook, public base URL, SEO title/description, hero assets,
  video JSON và testimonial JSON đã được phép công khai. Docker web chạy validation
  và từ chối build nếu còn giá trị demo/placeholder.
- `PUBLIC_HERO_HEADING` và `PUBLIC_OG_IMAGE_URL` phải khớp nội dung/ảnh Cô Vy đã
  duyệt. Đồng bộ domain thật vào `client/public/sitemap.xml` và `robots.txt` trước
  release; không thay placeholder bằng dữ liệu đoán.
- Chụp backup, kiểm tra restore gần nhất, rồi chạy image/tag đã duyệt.

## Triển khai

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d mysql
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrate.js
docker compose -f docker-compose.prod.yml run --rm api node dist/db/bootstrap-admin.js
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Kiểm tra `/health`, `/ready`, Homepage, login và critical API. Bootstrap admin là
thao tác chủ động một lần; production không chạy seed. Web phục vụ asset immutable,
API/MySQL có healthcheck/restart và volume `mysql-data:/var/lib/mysql`. Đặt TLS ở
reverse proxy/firewall, chỉ public cổng HTTP(S), không public MySQL.

Ở `/admin/login`, chọn **Ghi nhớ đăng nhập trên thiết bị này** chỉ trên thiết bị
riêng. Chế độ này giữ JWT/tên đăng nhập theo hạn JWT; bỏ chọn dùng phiên trình duyệt. Ứng
dụng không lưu mật khẩu thô—nếu cần, dùng password manager của trình duyệt.
Mức tối thiểu 6 ký tự là ranh giới tối giản cho V1; tăng
`ADMIN_PASSWORD_MIN_LENGTH` khi phạm vi public/rủi ro tăng. Có thể chủ động chạy
`npm run admin:reset-password` trong môi trường có database config để đổi mật khẩu
admin hiện hữu và tạo audit, thay vì bootstrap lại toàn bộ thuộc tính tài khoản.

Limiter hiện lưu trong memory của từng API process. Password reset chỉ xóa được
entry limiter khi dùng chung process/store; CLI độc lập không thể xóa memory của
API đang chạy. Deployment nhiều API instance cần shared store như Redis để có
giới hạn và thao tác xóa nhất quán.

Nginx container áp dụng CSP tương thích MUI, ảnh thumbnail và YouTube nocookie.
TLS terminator phải thêm HSTS sau khi kiểm tra HTTPS/subdomain; xem
`docs/security/security-notes.md`. Ghi số đo capacity theo checklist trong
`docs/deployment/backup-and-restore.md`, không suy diễn rằng 1 GB đã đủ khi chưa đo.

Rollback ứng dụng bằng image tag trước; migration chỉ tiến tới. Nếu migration làm
thay đổi dữ liệu không tương thích, dừng ghi, khôi phục backup vào database mới,
kiểm tra rồi chuyển dịch vụ. Không tự động reset database production.
