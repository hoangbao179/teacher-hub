# Hướng dẫn Cô Vy

## Đăng nhập và mật khẩu

Mở `/admin/login`, nhập username/password rồi chọn **Ghi nhớ đăng nhập** chỉ trên
thiết bị cá nhân. Khi chọn, ứng dụng lưu JWT và username trong
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
4. **Buổi học bù**: từ occurrence đã Nghỉ, chọn **Tạo buổi học bù** rồi chọn toàn
   lớp hoặc subset. Học sinh đã được bù cho cùng nguồn sẽ bị khóa. Buổi bù generic
   không có nguồn vẫn dùng được. Khi nhập muộn, dùng ngày học thật; hệ thống phân
   bổ lại theo thời gian nhưng không tự sửa đợt học phí Đã thu.
5. **Học phí**: theo dõi Chưa đủ 8 buổi/Cần thu/Đã thu/Dở dang và chỉ xác
   nhận thanh toán toàn bộ đúng mức đã chốt. Trên mobile, search nằm ngoài và lớp,
   trạng thái, sắp xếp nằm trong nút **Lọc**. Đợt Đã thu là chỉ đọc.
6. **Xác nhận lịch dạy/Lịch**: **Nghỉ** xử lý occurrence trước khi có draft;
   **Hủy bản nháp** giữ lesson/audit và cũng đưa occurrence nguồn về Nghỉ. Cả hai
   không tạo học phí. Lịch bận và conflict chỉ cảnh báo, không tự nghỉ/đổi lớp.
7. **Xuất Excel**: mở chi tiết học sinh và chọn **Xuất báo cáo Excel**. Workbook
   chuẩn hóa chứa lịch sử học/học phí/tổng hợp; không dùng làm generic import.
8. Tạm dừng/mở lại lớp hoặc ghi danh phải chọn ngày hiệu lực. Khoảng pause không
   sinh lịch/participant; lịch sử trước pause và dữ liệu nhập muộn vẫn theo ngày
   học thực tế. Đóng lớp/ngừng học không xóa lịch sử.
9. **Đổi lịch tạm thời** tại chi tiết lớp: chọn lịch gốc, khoảng ngày, thứ/giờ mới,
   xem preview và xác nhận conflict. Hết khoảng chọn, lịch tự quay về pattern gốc.

Tên lớp và học sinh trong buổi cũ là snapshot tại thời điểm tạo; đổi tên hiện tại
không thay đổi lịch sử. Correction có chủ ý vẫn tuân thủ audit, recalculation và
biên chu kỳ Đã thu.

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

## V15: lịch, học bù và tài chính

- **Đổi lịch tạm thời** cho phép chọn một hoặc nhiều lịch tuần; lịch không chọn
  giữ nguyên và hết khoảng áp dụng sẽ tự trở lại lịch gốc.
- Lịch thay thế có thể tiếp tục **Nghỉ**. Giữ chọn **Cần sắp xếp học bù**; danh
  sách **Buổi cần học bù** vẫn dùng được sau nhiều tuần. Học sinh vắng ở buổi bù
  tiếp tục còn chờ.
- **Thu học phí trước** ghi đúng một gói và chỉ tự đã thu khi đủ 8 buổi.
- Khi ngừng/chuyển lớp, đợt dở có thể chờ, chốt hoặc miễn; khoản thu trước có thể
  hoàn, dùng chốt đợt cũ hoặc chuyển sang enrollment mới.
- **Chuyển lớp** bắt đầu lớp mới ở 0/8 và giữ nguyên lịch sử lớp cũ.
