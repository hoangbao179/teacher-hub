# Hướng dẫn Cô Vy

## Đăng nhập và mật khẩu

Mở `/admin/login`, nhập username/password rồi chọn **Ghi nhớ đăng nhập** chỉ trên
thiết bị cá nhân. Khi chọn, ứng dụng lưu JWT và username trong
localStorage; khi bỏ chọn, JWT nằm trong sessionStorage và username không được giữ.
Ứng dụng không bao giờ lưu mật khẩu thô. Đề nghị lưu mật khẩu, nếu có, thuộc password
manager của trình duyệt. Nút góc phải đăng xuất và xóa token ở cả hai nơi.

Để đổi mật khẩu, chạy `npm run admin:reset-password` rồi nhập hai lần mật khẩu được che
cho username cố định `covy`. Nếu cần áp dụng lại bootstrap credential,
sửa `BOOTSTRAP_ADMIN_PASSWORD` và chủ động chạy
`npm run db:bootstrap-admin`; sửa `.env` hoặc chạy `npm run dev` không tự đổi database.
Mức tối thiểu V1 được cố định là 6 ký tự.

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
3. **Ghi nhận buổi học**: chọn lớp/ngày/giờ; dùng **Tất cả có mặt**,
   **Tất cả nghỉ** hoặc **Xóa lựa chọn**, rồi chỉnh ngoại lệ. Trạng thái gợi ý chưa
   được lưu cho đến khi xác nhận. Nhận xét chung xuất hiện cho phụ huynh; nhận xét
   riêng chỉ thuộc đúng học sinh. **Ghi chú nội bộ** không đưa sang Sheet.
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
8. **Import lịch sử Excel**: mở chi tiết đúng học sinh, chọn **Import lịch sử**, tải
   file `.xlsx`, xác nhận grade/class context của workbook và xử lý mọi mục Cần xử lý/
   Bị chặn. Hệ thống không tự chia grade tại 01/06; lesson trong Quá trình học tập
   không cần xác nhận chỉ vì thiếu dòng Học phí. Có thể sửa đúng trường được issue
   hỗ trợ, xác nhận một dòng hoặc bulk các dòng cùng trường hợp, ghép/tạo lesson hoặc bỏ qua với lý do. Kiểm tra
   tổng accepted/resolved/skipped rồi chọn **Xác nhận import**. Nếu file đã đổi sau
   preview, hệ thống từ chối và yêu cầu preview lại; import lại cùng file không tạo trùng.
9. **Sổ theo dõi phụ huynh**: tại chi tiết học sinh, chọn **Tạo sổ theo dõi**.
   Khi **Đã liên kết**, có thể mở/copy link hoặc tạo lại snapshot từ database.
   Sheet mặc định Restricted; cô Vy cấp Viewer thủ công trong Google Sheets.
   **Lưu trữ** không xóa file Google. Card hiển thị trạng thái đồng bộ lesson; khi
   cần, chọn **Đồng bộ lại** để xếp hàng toàn bộ lịch sử đã hoàn thành. Sheet vẫn
   Restricted và tab Học phí chưa được auto-sync trong V16D.
10. Tạm dừng/mở lại lớp hoặc ghi danh phải chọn ngày hiệu lực. Khoảng pause không
   sinh lịch/participant; lịch sử trước pause và dữ liệu nhập muộn vẫn theo ngày
   học thực tế. Đóng lớp/ngừng học không xóa lịch sử.
11. **Đổi lịch tạm thời** tại chi tiết lớp: chọn lịch gốc, khoảng ngày, thứ/giờ mới,
   xem preview và xác nhận conflict. Hết khoảng chọn, lịch tự quay về pattern gốc.

Tên lớp và học sinh trong buổi cũ là snapshot tại thời điểm tạo; đổi tên hiện tại
không thay đổi lịch sử. Correction có chủ ý vẫn tuân thủ audit, recalculation và
biên chu kỳ Đã thu.

## Homepage và liên hệ

Text, domain, Zalo, Facebook, SEO và media Homepage nằm trong
`client/src/content/publicHome.ts`; người triển khai không cấu hình nội dung công khai
qua biến môi trường. Ảnh public nằm trong `client/public/images` theo
`docs/content/replacing-public-media.md`. Testimonial chưa xác minh không được công khai
như phản hồi thật.

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
- **Chuyển lớp** giữ nguyên lịch sử lớp cũ và tiếp tục tiến độ đang dở khi giá gói
  không đổi; nếu giá đổi, giáo viên phải chọn cách xử lý đợt cũ.
