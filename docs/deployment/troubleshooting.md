# Troubleshooting

- Startup báo thiếu env: đối chiếu `server/.env.example`; production không có default.
- `/health` xanh nhưng `/ready` lỗi: kiểm tra MySQL, credentials, migration và volume.
- Login 429: chờ `Retry-After`; xem IP/proxy và lần đăng nhập sai, không restart để né bảo vệ.
- CORS: `CORS_ORIGIN` là danh sách origin đầy đủ, production dùng HTTPS.
- Sai ngày/giờ: host/container `TZ=Asia/Ho_Chi_Minh`, MySQL `+07:00`; dữ liệu ngày học là DATE.
- Excel lỗi: giữ request ID, student/filter và log; không gửi workbook chứa dữ liệu phụ huynh công khai.
- Migration lỗi: dừng deploy, không sửa migration cũ, kiểm tra backup và log request/startup đã khử secret.
