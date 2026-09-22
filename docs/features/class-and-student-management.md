# Class and student management

- `ONE_TO_ONE` và `GROUP` dùng chung bảng `classes`; một student tối đa một
  enrollment `ACTIVE`, được bảo vệ ở service và unique key MySQL.
- Lớp paused/closed không nhận enrollment mới; `ENDED` không resume. Chuyển lớp
  kết thúc enrollment cũ trước ngày enrollment mới và giữ toàn bộ lịch sử.
- Pause/resume/close/end có ngày hiệu lực; recurring schedule và lesson cũ không bị rewrite.
- Enrollment `FREE` vẫn được điểm danh Có mặt nhưng bị loại khỏi bảng học phí tháng.
  Các mode/price cũ còn trong schema để tương thích, không định giá payment tháng.
- Ngừng/chuyển học không tự tạo, chốt, nối hoặc quyết toán cycle/receipt cũ.
