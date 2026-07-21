# Hướng dẫn Cô Vy

## Đăng nhập và mật khẩu

Mở `/admin/login`, nhập username/password rồi chọn **Ghi nhớ đăng nhập trên thiết
bị này** chỉ trên thiết bị riêng. Khi chọn, ứng dụng lưu JWT và username trong
localStorage; khi bỏ chọn, JWT nằm trong sessionStorage và username không được giữ.
Ứng dụng không bao giờ lưu mật khẩu thô. Đề nghị lưu mật khẩu, nếu có, thuộc password
manager của trình duyệt. Nút góc phải đăng xuất và xóa token ở cả hai nơi.

Để đổi mật khẩu, chạy `npm run admin:reset-password`, chọn username mặc định rồi
nhập hai lần mật khẩu được che. Nếu cần áp dụng lại toàn bộ bootstrap credential,
sửa `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` và chủ động chạy
`npm run db:bootstrap-admin`; sửa `.env` hoặc chạy `npm run dev` không tự đổi database.
Mức tối thiểu V1 là 6 ký tự nhưng nên tăng trước khi public rộng.

Nếu nhập sai quá nhiều, form hiển thị countdown theo `Retry-After`, giữ nguyên nội
dung và tự mở lại nút đăng nhập ở 0. Trong development, restart API là cách đơn giản
để xóa limiter in-memory; không dùng cách này để né bảo vệ ở production.

## Điều hướng và thao tác hằng ngày

Trên điện thoại, thanh dưới có đúng năm mục **Hôm nay, Lịch, Lớp học, Học phí,
Học sinh**. Nút thao tác cố định nằm phía trên thanh. Desktop dùng sidebar.

1. **Lớp học → Thêm lớp**: môn học mặc định là Tiếng Anh; nhập giá gói 8 buổi,
   thời lượng và lịch lặp theo bốn khu vực rõ ràng của form.
2. **Học sinh → Thêm học sinh**, mở lớp và ghi danh; dùng search theo tên/tên gọi/lớp,
   sort A–Z/Z–A hoặc lọc trạng thái; chọn Theo giá lớp, Giá riêng
   hoặc Miễn phí theo ngày hiệu lực.
3. **Ghi nhận buổi học**: chọn lớp/ngày/giờ, điểm danh, nội dung và xác nhận. Chỉ
   Có mặt có tính phí mới cộng đợt học phí; Nghỉ/Miễn phí không cộng; số giờ không quy đổi buổi.
4. **Buổi học bù**: chọn đúng học sinh tham gia. Khi nhập muộn, dùng ngày học thật;
   hệ thống phân bổ lại theo thời gian nhưng không tự sửa đợt học phí Đã thu.
5. **Học phí**: theo dõi Chưa đủ 8 buổi/Cần thu/Đã thu/Dở dang và chỉ xác
   nhận thanh toán toàn bộ đúng mức đã chốt. Trên mobile, search nằm ngoài và lớp,
   trạng thái, sắp xếp nằm trong nút **Lọc**. Đợt Đã thu là chỉ đọc.
6. **Xác nhận lịch dạy/Lịch**: buổi dự kiến phải được đánh dấu Đã dạy, Nghỉ hoặc Đổi
   lịch; lịch lặp không tự sinh học phí. Lịch bận dùng để cảnh báo trùng.
7. **Xuất Excel**: mở chi tiết học sinh và chọn **Xuất báo cáo Excel**. Workbook
   chuẩn hóa chứa lịch sử học/học phí/tổng hợp; không dùng làm generic import.
8. Tạm dừng/đóng lớp hoặc cho học sinh ngừng học bằng đổi trạng thái, không xóa lịch sử.

## Homepage và liên hệ

Contact/domain/media do người triển khai cấu hình qua `PUBLIC_*`/`VITE_PUBLIC_*`.
CTA thiếu hoặc sai sẽ bị ẩn; không tự điền thông tin đoán. Ảnh public hiện có thể là
media tạm theo `docs/content/replacing-public-media.md`. Testimonial chưa xác minh
không được công khai như phản hồi thật.

Vite local dùng cố định cổng 5173 và không tự nhảy sang 5174. Nếu cổng bị chiếm trên Windows:

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Footer public luôn là `2026 — từ người hâm mộ cô Vy, with love ❤️`.

V1 không gửi Zalo/email tự động, không có tài khoản phụ huynh, payment gateway,
thanh toán một phần hay nhiều giáo viên.
