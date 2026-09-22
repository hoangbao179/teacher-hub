# 06. Screen specifications

## Admin navigation

Mobile có đúng năm mục một dòng: Hôm nay, Lịch, Lớp học, Học phí, Học sinh.
Desktop dùng sidebar. Không có page-level horizontal scroll ở 360–430 px.

## Hôm nay và ghi buổi

Buổi chưa ghi có CTA **Ghi buổi**. Màn ghi nhanh hiển thị participant mặc định Có
mặt; cô chỉ đánh dấu Nghỉ. Nội dung, bài tập, nhận xét chung/riêng là tùy chọn.
Full editor dành cho ngoại lệ và thao tác nâng cao.

## Học phí

Màn `/admin/tuition` mặc định tháng hiện tại tại Việt Nam, có chuyển tháng trước/sau,
lọc lớp, tìm học sinh và trạng thái. Desktop dùng bảng gọn; mobile dùng card. Mỗi
row hiển thị học sinh, lớp, `present/total`, số vắng và `Chưa thu|Đã thu`.
Action **Đã thu** nhận ngày, amount VND và note; amount/note không bắt buộc.

## Student Detail

Bề mặt chính hiển thị lớp, miễn phí hay theo dõi theo tháng, và trạng thái sổ phụ
huynh. Công cụ nâng cao chứa sửa dữ liệu, chuyển/ngừng học, export Excel và recovery
Google Sheet. Không có Legacy Import hay action cycle/receipt.
