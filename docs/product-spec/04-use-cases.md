# 04. Use Cases

## UC-01 Đăng nhập
Giáo viên nhập thông tin đăng nhập, hệ thống xác thực và chuyển đến Dashboard.

## UC-02 Tạo/sửa lớp
Giáo viên nhập tên, loại lớp, môn, giá mặc định, thời lượng dự kiến, ngày bắt đầu, lịch lặp và học sinh. Hệ thống kiểm tra một học sinh không có ghi danh ACTIVE khác.

## UC-03 Thêm/sửa học sinh
Quản lý hồ sơ tối giản: tên, tên gọi, phụ huynh, điện thoại, ghi chú và lớp hiện tại.

## UC-04 Đổi chế độ học phí
Chọn theo giá lớp, giá riêng hoặc miễn phí hoàn toàn. Thay đổi áp dụng từ chu kỳ tiếp theo.

## UC-05 Ghi nhận buổi học
Chọn lớp/buổi, nhập ngày, giờ dự kiến, giờ thực tế, loại buổi, điểm danh, nội dung và bài tập; xem lại rồi hoàn thành.

## UC-06 Đối soát buổi chưa ghi nhận
Hệ thống suy ra occurrence từ lịch lặp. Giáo viên chọn Đã dạy, Nghỉ hoặc Đổi lịch. Chỉ Đã dạy + điểm danh mới tạo dữ liệu học tập/học phí.

## UC-07 Tạo buổi học bù
Chọn lớp, ngày giờ và một số học sinh. Chỉ học sinh được chọn mới có attendance; mặc định tính phí nếu chọn Có mặt, có thể đổi thành Miễn phí.

## UC-08 Quản lý chu kỳ học phí
Xem tiến độ, tám buổi trong chu kỳ, giá snapshot và trạng thái. Khi đủ 8 buổi hệ thống tự chuyển Cần thu.

## UC-09 Đánh dấu đã thu
Nhập số tiền toàn bộ, ngày thu, hình thức và ghi chú. Sau xác nhận, chu kỳ khóa.

## UC-10 Tạm dừng/đóng lớp
Tạm dừng có thể mở lại. Đóng lớp kết thúc lịch mới nhưng giữ lịch sử và công nợ.

## UC-11 Cho học sinh ngừng học
Nhập ngày và lý do. Chu kỳ dưới 8 buổi chuyển INCOMPLETE; chu kỳ đủ 8 hoặc chưa thu vẫn giữ.

## UC-12 Quản lý lịch bận
Thêm lịch dạy ở trường/việc riêng dạng lặp hoặc một lần; chỉ dùng lịch và cảnh báo trùng.
