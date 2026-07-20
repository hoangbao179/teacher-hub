# 11. Excel Export Specification

## Phạm vi
Xuất theo từng học sinh, có thể tạo workbook hai sheet tương tự file hiện tại nhưng dữ liệu chuẩn hóa.

## Sheet Quá trình học tập
- Ngày học.
- Giờ dự kiến.
- Giờ thực tế.
- Thời lượng thực tế (phút hoặc hh:mm).
- Loại buổi.
- Trạng thái Có mặt/Nghỉ/Miễn phí.
- Nội dung buổi học.
- Bài tập về nhà.
- Nhận xét riêng.

## Sheet Học phí
- Chu kỳ số.
- Tám buổi tính phí.
- Ngày, giờ dự kiến, giờ thực tế từng buổi.
- Giá snapshot.
- Trạng thái Cần thu/Đã thu/Chưa hoàn thành.
- Ngày thu, hình thức thu, ghi chú.

## Quy tắc
- Buổi nghỉ và miễn phí có trong lịch sử học nhưng không nằm trong tám dòng tính phí.
- Giờ thực tế cho phụ huynh biết buổi học kéo dài, nhưng không quy đổi tiền.
- Không lặp thông tin ngân hàng trên từng dòng; cấu hình một lần khi cần tạo phiếu gửi phụ huynh.
- Workbook canonical có ba sheet `Quá trình học tập`, `Học phí`, `Tổng hợp`,
  được tạo từ database sau khi xác thực giáo viên.
- Text do người dùng nhập được trung hòa nếu bắt đầu bằng ký tự công thức Excel;
  tiền là cell số nguyên với format VND.
- Export được audit nhưng workbook bytes không được lưu trong database hoặc file tạm.

## Trạng thái legacy migration

Generic Excel import và tự động phân tích file cũ không thuộc V1. Các workbook
legacy cần một quy trình migration riêng có preview, làm sạch và xác nhận; không
được coi là định dạng canonical của workbook xuất ra.
