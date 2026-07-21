# 01. Product Overview

## Mục tiêu
Xây dựng website mobile-first **Lớp học cô Vy** tại Huế, gồm trang public giới
thiệu chương trình Tiếng Anh lớp 1–9 và khu vực quản trị để quản lý lớp, học sinh,
lịch học, buổi học, tiến độ gói 8 buổi và học phí.

## Người dùng
- Một tài khoản giáo viên duy nhất trong V1.
- Học sinh và phụ huynh là dữ liệu nghiệp vụ, không có tài khoản đăng nhập.

## Hai vùng chức năng
1. **Trang public:** giới thiệu Cô Vy, lớp 1–1/nhóm nhỏ, hỗ trợ vững nền tảng,
   bám sát chương trình trường, ôn kiểm tra và chuẩn bị Nguyễn Tri Phương; có
   video, phản hồi đã xác minh và liên hệ, không công khai học phí.
2. **Trang quản trị:** quản lý lớp 1 kèm 1/lớp nhóm, học sinh, lịch lặp, lịch bận, ghi nhận buổi học, đối soát dữ liệu nhập muộn và học phí theo chu kỳ 8 buổi.

## Nguyên tắc sản phẩm
- Mobile-first, thao tác một tay, không phụ thuộc bảng rộng.
- Lịch định kỳ chỉ là dự kiến; chỉ buổi được xác nhận đã dạy và điểm danh mới ảnh hưởng học phí.
- Giờ dự kiến và giờ thực tế được lưu riêng.
- Học phí tính theo buổi, không quy đổi theo số giờ.
- Ảnh V2 từ ứng dụng chạy thật là tham chiếu styling hiện hành. Wireframe P0 chỉ
  tham chiếu workflow/phân cấp; business rules và screen specification là nguồn
  đúng khi có xung đột.
