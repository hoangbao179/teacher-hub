# Production deployment

## Chuẩn bị

- Linux host, Docker Compose, DNS và HTTPS reverse proxy; cấu hình tham chiếu phù
  hợp máy nhỏ khoảng 1 CPU/1 GB RAM/15 GB SSD nhưng chưa được benchmark tại mức đó.
- Tạo secret ngẫu nhiên tối thiểu 32 ký tự; không dùng giá trị `.env.example`.
- Đặt `PUBLIC_URL=https://...`, DB credentials riêng, và giữ file env ngoài Git.
- Cấu hình toàn bộ `PUBLIC_*` trong `deploy/env.example`: tên/brand giáo viên,
  điện thoại, Zalo, Facebook, public base URL, SEO title/description, hero assets,
  video JSON và testimonial JSON đã được phép công khai. Docker web chạy validation
  và từ chối build nếu còn giá trị demo/placeholder.
- Chụp backup, kiểm tra restore gần nhất, rồi chạy image/tag đã duyệt.

## Triển khai

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d mysql
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrate.js
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Kiểm tra `/health`, `/ready`, Homepage, login và critical API. Bootstrap admin là
thao tác chủ động một lần; production không chạy seed. Web phục vụ asset immutable,
API/MySQL có healthcheck/restart và volume `mysql-data:/var/lib/mysql`. Đặt TLS ở
reverse proxy/firewall, chỉ public cổng HTTP(S), không public MySQL.

Nginx container áp dụng CSP tương thích MUI, ảnh thumbnail và YouTube nocookie.
TLS terminator phải thêm HSTS sau khi kiểm tra HTTPS/subdomain; xem
`docs/security/security-notes.md`. Ghi số đo capacity theo checklist trong
`docs/deployment/backup-and-restore.md`, không suy diễn rằng 1 GB đã đủ khi chưa đo.

Rollback ứng dụng bằng image tag trước; migration chỉ tiến tới. Nếu migration làm
thay đổi dữ liệu không tương thích, dừng ghi, khôi phục backup vào database mới,
kiểm tra rồi chuyển dịch vụ. Không tự động reset database production.
