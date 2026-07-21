# Hướng dẫn giáo viên

1. Đăng nhập ở `/admin/login` bằng tên đăng nhập và mật khẩu đã cấu hình. Chọn
   **Ghi nhớ đăng nhập trên thiết bị này** trên điện thoại riêng để giữ phiên và tên đăng nhập; bỏ chọn trên thiết bị dùng chung để phiên
   kết thúc khi đóng trình duyệt. Ứng dụng không lưu mật khẩu thô; việc đề nghị lưu
   mật khẩu thuộc password manager của trình duyệt. Dùng nút góc phải để đăng xuất.
2. **Lớp học → Thêm lớp**: nhập giá gói 8 buổi, thời lượng và lịch lặp.
3. **Học sinh → Thêm học sinh**, mở lớp và **Ghi danh**; chọn học phí theo lớp,
   giá riêng hoặc miễn phí. Có thể đổi chế độ có ngày hiệu lực.
4. **Ghi nhận buổi học**: chọn lớp/ngày/giờ, điểm danh, nội dung rồi xác nhận.
   Có mặt mới tính phí; Nghỉ/Miễn phí không tính; thời lượng dài không tăng số buổi.
5. **Buổi học bù**: chỉ chọn học sinh thực sự tham gia. Với nhập muộn, chọn đúng
   ngày lịch sử; hệ thống phân bổ lại theo thời gian nhưng không sửa chu kỳ Đã thu.
6. **Học phí**: theo dõi Đang tích lũy/Cần thu/Đã thu/Chưa hoàn thành. Chỉ xác nhận
   thanh toán toàn bộ đúng snapshot; chu kỳ Đã thu trở thành chỉ đọc.
7. **Đối soát**: với lịch dự kiến chọn Đã dạy, Nghỉ hoặc Đổi lịch. Lịch lặp chỉ là
   dự kiến và không tự tạo học phí.
8. **Lịch → Lịch bận**: thêm việc riêng/một lần/hằng tuần để cảnh báo trùng lịch.
9. **Xuất Excel**: mở học sinh, chọn **Xuất báo cáo Excel**; workbook chuẩn hóa có
   quá trình học, học phí và tổng hợp. File legacy cần migration riêng, không import tự động.
10. Trên chi tiết lớp có thể Tạm dừng/Đóng lớp; trên học sinh có thể Tạm dừng hoặc
    **Cho ngừng học**. Mọi lịch sử và chu kỳ liên quan được giữ lại.
11. Trên điện thoại, thanh dưới gồm **Hôm nay, Lịch, Lớp học, Học phí, Học sinh**.
    Các nút thao tác cố định luôn nằm phía trên thanh này.

## Liên hệ trên Homepage

Số điện thoại, Zalo, Facebook và domain public do người triển khai cấu hình trong
`deploy/env.example`/biến `PUBLIC_*`. Nếu thấy “Chưa cấu hình” hoặc banner nội dung
minh họa, chưa nên chia sẻ Homepage như trang chính thức; không tự nhập thông tin đoán.

V1 không gửi Zalo/email tự động, không có tài khoản phụ huynh, payment gateway hay
thanh toán một phần.
