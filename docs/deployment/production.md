# Production deployment

## Chuẩn bị

- Linux host, Docker Compose, DNS và HTTPS reverse proxy; cấu hình tham chiếu phù
  hợp máy nhỏ khoảng 1 CPU/1 GB RAM/15 GB SSD nhưng chưa được benchmark tại mức đó.
- Tạo secret ngẫu nhiên tối thiểu 32 ký tự; không dùng giá trị `.env.example`.
- Đặt `PUBLIC_URL=https://...`, DB credentials riêng, và giữ file env ngoài Git.
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

Rollback ứng dụng bằng image tag trước; migration chỉ tiến tới. Nếu migration làm
thay đổi dữ liệu không tương thích, dừng ghi, khôi phục backup vào database mới,
kiểm tra rồi chuyển dịch vụ. Không tự động reset database production.
