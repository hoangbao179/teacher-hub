# 06. Screen Specifications

## Thứ tự nguồn đúng
1. Business rules.
2. Screen specification.
3. Acceptance tests.
4. Wireframe.

## 01 Homepage public mobile
- Route gợi ý: `/`.
- Section: header, giới thiệu, chương trình học, phương pháp,
  video, phản hồi phụ huynh, CTA liên hệ và footer.
- Homepage không có hero chuyển cảnh; video dài YouTube chỉ tải khi bấm.
- Không hiển thị học phí; không CMS; contact hợp lệ mới xuất hiện và Zalo ưu tiên.

## 02 Admin Dashboard
- Route: `/admin`.
- Hiển thị: cần thu học phí, buổi chưa ghi nhận, lịch hôm nay, thống kê nhanh.
- Thao tác chính: mở học phí, đối soát, ghi nhận buổi.

## 03 Buổi chưa ghi nhận
- Route: `/admin/unrecorded`.
- Bộ lọc tuần/lớp, chọn nhiều occurrence.
- Mỗi occurrence có Đã dạy/Nghỉ/Đổi lịch.
- Không tự cộng học phí khi chỉ tồn tại lịch dự kiến.

## 04 Ghi nhận buổi - thông tin
- Chọn lớp, ngày học, giờ dự kiến, giờ bắt đầu/kết thúc thực tế, loại buổi, ghi chú.
- Validate end > start; hiển thị thời lượng phút.

## 05 Ghi nhận buổi - điểm danh
- Mỗi học sinh bắt buộc có một trạng thái: Có mặt/Nghỉ/Miễn phí.
- Mặc định học sinh trả phí là Có mặt; học sinh FREE là Miễn phí.
- Cho phép nhận xét riêng tùy chọn.

## 06 Ghi nhận buổi - nội dung và bài tập
- Nội dung buổi học, bài tập về nhà, ghi chú chung.
- Nội dung có thể để trống khi cập nhật nhanh, nhưng UI khuyến khích nhập.

## 07 Ghi nhận buổi - xác nhận
- Hiển thị summary thời gian, loại buổi, số có mặt/nghỉ/miễn phí, nội dung.
- Hiển thị tác động dự kiến lên tiến độ 8 buổi.
- Nút Sửa lại và Hoàn tất.

## 08 Danh sách lớp
- Tab Đang dạy/Tạm dừng/Đã đóng, tìm kiếm, thêm lớp.
- Card hiển thị loại, số học sinh, lịch, giá mặc định và cảnh báo cần thu.

## 09 Chi tiết lớp
- Thông tin lớp, quick actions, danh sách học sinh + tiến độ.
- Hành động: sửa, tạm dừng, đóng lớp, ghi buổi, học bù, lịch học.

## 10 Tạo/sửa lớp
- Tên, loại, môn, giá gói, thời lượng, ngày bắt đầu, lịch lặp, học sinh, trạng thái.
- Với 1 kèm 1 chỉ cho tối đa một enrollment ACTIVE.

## 11 Danh sách học sinh
- Tab đang học/ngừng học/miễn phí; tìm kiếm, thêm học sinh.
- Hiển thị lớp, tiến độ, trạng thái cần thu.

## 12 Chi tiết học sinh
- Tabs tổng quan/lịch sử học/học phí.
- Hiển thị lớp, tiến độ, chế độ giá, phụ huynh, ghi chú.
- Hành động sửa, đổi học phí, cho ngừng học.

## 13 Chế độ học phí học sinh
- Chọn Theo giá lớp/Giá riêng/Miễn phí.
- Hiển thị ngày áp dụng và cảnh báo chỉ ảnh hưởng chu kỳ tiếp theo.

## 14 Danh sách học phí
- Tab Đang tích lũy/Cần thu/Đã thu/Chưa hoàn thành.
- Card hiển thị học sinh, lớp, cycle number, tiến độ, giá snapshot.

## 15 Chi tiết chu kỳ
- Hiển thị 8 attendance tính phí với ngày, giờ dự kiến, giờ thực tế.
- Hiển thị giá snapshot, ngày bắt đầu, ngày buổi 8 và trạng thái.

## 16 Đánh dấu đã thu
- Số tiền toàn bộ, ngày thu, hình thức tiền mặt/chuyển khoản, ghi chú.
- Không hỗ trợ một phần; xác nhận sẽ khóa chu kỳ.

## 17 Lịch tuần/lịch bận
- Hiển thị lớp học, lịch bận, học bù, đổi lịch bằng màu/nhãn khác nhau.
- Thêm lịch bận; cảnh báo trùng nhưng nhập dữ liệu cũ có thể cho phép override.

## 18 Tạo buổi học bù
- Chọn lớp, ngày, giờ dự kiến/thực tế, chọn học sinh, ghi chú.
- Không bắt buộc liên kết với buổi nghỉ cũ.
