# Class and student management

- `ONE_TO_ONE` và `GROUP` dùng cùng bảng `classes`.
- Một học sinh tối đa một enrollment `ACTIVE`.
- Giá lớp là mặc định; enrollment có thể `CUSTOM` hoặc `FREE`.
- Đóng lớp/ngừng học không xóa dữ liệu.
- Enrollment ngừng ở dưới 8 buổi chuyển chu kỳ cuối sang `INCOMPLETE` khi flow được triển khai.

Các action đóng/tạm dừng/ngừng học chưa được nối UI trong base; triển khai theo product spec và state machine.
