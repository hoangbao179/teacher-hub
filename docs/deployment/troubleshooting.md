# Troubleshooting

- Startup báo thiếu env: đối chiếu `server/.env.example`; production không có default.
- `/health` xanh nhưng `/ready` lỗi: kiểm tra MySQL, credentials, migration và volume.
- Login 429: UI đếm ngược theo `Retry-After`; xem IP/proxy và số lần đăng nhập sai.
  Development có thể restart API để xóa limiter in-memory; production không
  restart để né bảo vệ. Nhiều instance cần shared store để state nhất quán.
- Vite báo cổng 5173 đang dùng: trên Windows chạy `netstat -ano | findstr :5173`,
  xác minh PID rồi `taskkill /PID <PID> /F`. Vite dùng strict port và không tự
  chuyển sang 5174.
- CORS: `CORS_ORIGIN` là danh sách origin đầy đủ, production dùng HTTPS.
- Sai ngày/giờ: host/container `TZ=Asia/Ho_Chi_Minh`, MySQL `+07:00`; dữ liệu ngày học là DATE.
- Excel lỗi: giữ request ID, student/filter và log; không gửi workbook chứa dữ liệu phụ huynh công khai.
- Migration lỗi: dừng deploy, không sửa migration cũ, kiểm tra backup và log request/startup đã khử secret.
