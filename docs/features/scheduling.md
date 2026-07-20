# Scheduling and reconciliation

Recurring schedule chỉ là lịch dự kiến. Không tự tính là đã học.

Occurrence được sinh từ `recurring_schedules` trong khoảng hiệu lực và có khóa ổn
định `classId:recurringScheduleId:yyyy-mm-dd`. Kết quả được đối soát với
`schedule_exceptions` và `lesson_sessions.source_occurrence_key`, sắp theo ngày/giờ
cũ nhất trước và không tự tạo lesson.

Các trạng thái:

- `UNRECORDED`: chưa có lesson hoặc exception xử lý occurrence.
- `RECORDED`: đã có lesson `DRAFT`, `COMPLETED` hoặc `CANCELLED`. Lesson bị hủy vẫn
  là một quyết định rõ ràng của giáo viên nên occurrence không tự xuất hiện lại.
- `SKIPPED`: occurrence gốc đã được đánh dấu nghỉ.
- `RESCHEDULED`: occurrence gốc đã đổi lịch; một projection thay thế có hậu tố
  khóa `:R` xuất hiện tại ngày/giờ mới và có thể tiếp tục tạo lesson draft.

Nút “Đã dạy” chỉ tạo lesson `DRAFT` qua canonical lesson service để snapshot học
sinh đủ điều kiện. Điểm danh, hoàn thành và phân bổ học phí vẫn diễn ra trong lesson
wizard M2/M3. Tạo draft, nghỉ và đổi lịch đều idempotent với cùng payload.

Bulk create-draft và bulk-skip xử lý độc lập từng occurrence, trả kết quả thành
công/lỗi theo item. Bulk không hoàn thành lesson và không tạo attendance/học phí.

Đổi lịch chỉ áp dụng một occurrence, không sửa lịch lặp. Lịch dạy ở trường là `teacher_busy_slots`, không có học sinh/học phí.

Conflict detection dùng khoảng thời gian half-open và trả cảnh báo khi trùng với
projection, lesson (gồm học bù/đổi lịch) hoặc lịch bận. Cảnh báo không âm thầm chặn
nhập dữ liệu lịch sử và không tự thay đổi sự kiện khác.

Lịch bận hỗ trợ một lần hoặc lặp hằng tuần trong khoảng hiệu lực. Các mutation lưu
actor/audit nhưng không có quan hệ enrollment, attendance hay tuition.
