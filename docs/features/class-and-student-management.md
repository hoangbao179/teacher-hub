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

V15 chuyển lớp atomic: enrollment cũ kết thúc ở ngày trước ngày chuyển và
enrollment/policy/active period mới bắt đầu đúng ngày chuyển. Từ V16B, đợt dở
tiếp tục theo student khi giá không đổi; khi giá đổi vẫn dùng quyết định explicit. Đợt dở và
receipt được xử lý theo lựa chọn; lesson, attendance và cycle cũ không bị sửa.

## Trạng thái V16B–V16E

Baseline V15 ở trên vẫn là runtime hiện hành. Thiết kế theo dõi phụ huynh mới tại
`student-parent-tracking.md` yêu cầu một Sheet ACTIVE theo `student_id`, không theo
class/enrollment, và giữ URL khi lên lớp/chuyển nhóm/tạm nghỉ/quay lại.

V16B đã thay đổi recalculation để cycle dở có thể tiếp tục theo student
qua enrollment: 5/8 trước chuyển lớp tiếp tục 6/8 sau chuyển nếu giá không đổi. Nếu
giá/hình thức học đổi, giáo viên phải quyết định explicit; hệ thống không reset hoặc
quyết toán âm thầm. Google Sheet vẫn chưa được triển khai.
