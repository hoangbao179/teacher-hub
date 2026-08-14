# Hướng dẫn Cô Vy

## Đăng nhập

Mở `/admin/login`, nhập username và mật khẩu. Chỉ chọn **Ghi nhớ đăng nhập** trên
thiết bị cá nhân. Có thể mở avatar → **Tài khoản** để xem tên đăng nhập hoặc đăng
xuất. Đổi mật khẩu và cập nhật thông tin tài khoản trong giao diện đang được hoàn
thiện; khi cần đổi mật khẩu, nhờ người vận hành hệ thống hỗ trợ.

## Ghi buổi hằng ngày

Trên điện thoại, thanh dưới có đúng năm mục **Hôm nay, Lịch, Lớp học, Học phí,
Học sinh**. Nút thao tác cố định nằm phía trên thanh. Desktop dùng sidebar.

Luồng chính sau mỗi buổi học:

1. **Đăng nhập** và mở **Hôm nay**.
2. Tìm lớp vừa dạy, chọn **Ghi buổi**. Nếu đã có bản nháp, chọn **Tiếp tục ghi**.
3. Học sinh được mặc định **Có mặt**; chỉ chuyển sang **Nghỉ** với em vắng mặt.
   Học sinh miễn phí vẫn hiển thị đúng trạng thái miễn phí và có thể chuyển sang Nghỉ.
4. Nhập **Nội dung buổi học**, **Bài tập về nhà** hoặc **Nhận xét chung** nếu cần.
   Nhận xét riêng của từng học sinh nằm dưới nút mở rộng và cũng không bắt buộc.
5. Chọn **Lưu & hoàn tất**.
6. Khi hoàn tất, chọn **Về Hôm nay** để tiếp tục hoặc kết thúc công việc.

Teacher Hub là nơi cô nhập buổi học. Hệ thống tự đồng bộ dữ liệu đã hoàn thành sang
Google Sheet là sổ phụ huynh; trong công việc hằng ngày cô chỉ cần kiểm tra trạng
thái dễ hiểu và dùng **Mở sổ phụ huynh** khi muốn xem. Không cần thao tác công cụ
khôi phục kỹ thuật nếu sổ đang hoạt động bình thường.

## Khi cần — quản lý và thao tác nâng cao

1. **Lớp học → Thêm lớp**: môn học mặc định là Tiếng Anh; nhập giá gói 8 buổi,
   thời lượng và lịch lặp theo bốn khu vực rõ ràng của form.
2. **Học sinh → Thêm học sinh**, mở lớp và ghi danh; dùng search theo tên/tên gọi/lớp,
   sort A–Z/Z–A hoặc lọc trạng thái; chọn Theo giá lớp, Giá riêng
   hoặc Miễn phí theo ngày hiệu lực.
3. **Chỉnh sửa đầy đủ/tạo buổi thủ công**: từ màn ghi nhanh chọn **Chỉnh sửa đầy đủ**
   để mở màn chỉnh sửa đầy đủ mà không mất bản nháp. Luồng này dành cho giờ thực tế,
   ghi chú nội bộ, buổi ngoài lịch, học thêm và các trường hợp không thuộc buổi
   thường hằng ngày. **Ghi chú nội bộ** không đưa sang Sheet.
4. **Buổi học bù**: từ buổi dự kiến đã đánh dấu Nghỉ, chọn **Tạo buổi học bù** rồi chọn toàn
   lớp hoặc một số học sinh. Học sinh đã được bù cho cùng nguồn sẽ bị khóa. Buổi bù
   không gắn buổi nguồn vẫn dùng được. Khi nhập muộn, dùng ngày học thật; hệ thống phân
   bổ lại theo thời gian nhưng không tự sửa đợt học phí Đã thu.
5. **Học phí**: theo dõi Chưa đủ 8 buổi/Cần thu/Đã thu/Dở dang và chỉ xác
   nhận thanh toán toàn bộ đúng mức đã chốt. Trên mobile, search nằm ngoài và lớp,
   trạng thái, sắp xếp nằm trong nút **Lọc**. Đợt Đã thu là chỉ đọc.
6. **Kiểm tra lịch tuần**: dùng cho lịch cũ và ngoại lệ, không phải
   bước bắt buộc trước khi ghi buổi thường. **Nghỉ** xử lý lịch dự kiến trước khi có draft;
   **Hủy bản nháp** giữ lịch sử và cũng đưa buổi nguồn về Nghỉ. Cả hai không tạo
   học phí. Lịch bận và trùng lịch chỉ cảnh báo, không tự nghỉ/đổi lớp.
7. **Xuất Excel**: mở chi tiết học sinh và chọn **Xuất báo cáo Excel**. Workbook
   chuẩn hóa chứa lịch sử học/học phí/tổng hợp; không dùng làm generic import.
8. **Import lịch sử Excel**: mở chi tiết đúng học sinh, chọn **Import lịch sử**, tải
   file `.xlsx`, xác nhận grade/class context của workbook và xử lý mọi mục Cần xử lý/
   Bị chặn. Hệ thống không tự chia grade tại 01/06; lesson trong Quá trình học tập
   không cần xác nhận chỉ vì thiếu dòng Học phí. Có thể sửa đúng trường được issue
   hỗ trợ, xác nhận một dòng hoặc bulk các dòng cùng trường hợp, ghép/tạo lesson hoặc bỏ qua với lý do. Kiểm tra
   tổng accepted/resolved/skipped rồi chọn **Xác nhận import**. Nếu file đã đổi sau
   preview, hệ thống từ chối và yêu cầu preview lại; import lại cùng file không tạo trùng.
9. **Sổ phụ huynh**: tại chi tiết học sinh, chọn **Tạo Google Sheet** nếu chưa có;
   khi sổ hoạt động, dùng **Mở sổ phụ huynh** hoặc **Sao chép liên kết**. Sheet mặc
   định Restricted nên cô Vy cấp Viewer thủ công trong Google Sheets. Chỉ khi có
   lỗi mới mở **Công cụ nâng cao** để đồng bộ lại, thử tạo lại, tạo lại nội dung hoặc
   lưu trữ Sheet; các thao tác này không thuộc luồng hằng ngày.
10. Tạm dừng/mở lại lớp hoặc ghi danh phải chọn ngày hiệu lực. Khoảng tạm dừng không
   sinh lịch/danh sách học sinh; lịch sử trước đó và dữ liệu nhập muộn vẫn theo ngày
   học thực tế. Đóng lớp/ngừng học không xóa lịch sử.
11. **Đổi lịch tạm thời** tại chi tiết lớp: chọn lịch gốc, khoảng ngày, thứ/giờ mới,
   xem trước và xác nhận trùng lịch. Hết khoảng chọn, lịch tự quay về lịch gốc.
12. **Lớp học ghép**: chỉ dùng nhóm lớp học ghép khi thực tế dạy
    nhiều lớp trong cùng một buổi. Luồng này giữ đúng danh sách học sinh và các buổi
    liên quan, không thay thế cách ghi buổi thường từ **Hôm nay**.

Tên lớp và danh sách học sinh trong buổi cũ được giữ theo thời điểm tạo; đổi tên
hiện tại không thay đổi lịch sử. Khi cần sửa dữ liệu cũ, dùng đúng luồng nâng cao để
hệ thống tính lại và vẫn bảo vệ các đợt học phí **Đã thu**.

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
