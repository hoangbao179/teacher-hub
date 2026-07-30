# ADR: occurrence cha cho nhóm học ghép

## Decision

`CombinedClassGroup` là thực thể lịch dạy, không phải một `Class`. Nhóm giữ danh
sách lớp thành viên, lịch tuần và khoảng hiệu lực. Resolver tạo một occurrence
nhóm ảo; trong đúng ngày/giờ nhóm, các recurring occurrence bị chồng của lớp
thành viên bị suppress mà không sửa `recurring_schedules` gốc.

Do `lesson_sessions` và toàn bộ attendance/tuition hiện phụ thuộc vào `class_id`,
khi cô giáo bắt đầu ghi nhận hệ thống tạo một
`CombinedTeachingOccurrence` cha và đúng một lesson con cho mỗi lớp thành viên.
UI hiển thị một card cha. Tạo nháp và hoàn thành các lesson con chạy trong cùng
transaction; retry dùng unique key của occurrence và không tạo lesson/tiến độ
lặp.

Attendance, enrollment, chu kỳ 8 buổi và học phí tiếp tục thuộc lesson con của
từng lớp. Thống kê ca dạy dùng occurrence cha nên một ca ghép chỉ là một ca làm
việc của giáo viên.

Theo ADR-0002, occurrence nhóm cũng được resolve động; database chỉ lưu
occurrence khi ca được tạo nháp, cho nghỉ hoặc đổi lịch. Lịch sử đã xử lý chặn
thay đổi cấu trúc nhóm có thể viết lại quá khứ.
