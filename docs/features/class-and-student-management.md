# Class and student management

- `ONE_TO_ONE` và `GROUP` dùng cùng bảng `classes`.
- Một học sinh tối đa một enrollment `ACTIVE`.
- Rule trên được kiểm tra ở service và bảo vệ cuối cùng bằng generated key +
  unique index `uq_enrollments_one_active_per_student` trong MySQL.
- Giá lớp là mặc định; enrollment có thể `CUSTOM` hoặc `FREE`.
- Giá gói lớp là integer VND dương cho đúng 8 buổi; `0` không biểu diễn miễn phí.
- Lớp `PAUSED` hoặc `CLOSED` không nhận enrollment active mới; resume enrollment
  cũng yêu cầu lớp đang `ACTIVE`.
- Đóng lớp/ngừng học không xóa dữ liệu.
- Pause/resume lớp và ghi danh nhận ngày hiệu lực, đóng/mở active period thay vì
  rewrite lịch sử. Recurring schedule không bị clone chỉ vì pause/resume.
- Enrollment ngừng ở dưới 8 buổi chuyển chu kỳ cuối sang `INCOMPLETE`; cycle
  `PAYMENT_DUE` hoặc `PAID` hiện hữu giữ nguyên.
- Enrollment `ENDED` không resume. Học sinh quay lại phải có enrollment mới;
  cycle của enrollment cũ không được nối hoặc mở lại.

UI M1.1 đã nối create/edit, pause/resume/close class, create enrollment,
pause/resume/end enrollment và change tuition mode với loading/error/success và
confirmation cho transition phá hủy lịch sử hoạt động. Các mutation này có audit.
