# Scheduling and reconciliation

Recurring schedule chỉ là lịch dự kiến. Không tự tính là đã học.

Occurrence được sinh từ `recurring_schedules` trong khoảng hiệu lực và có khóa ổn
định `classId:recurringScheduleId:yyyy-mm-dd`. Kết quả được đối soát với
`schedule_exceptions` và `lesson_sessions.source_occurrence_key`, sắp theo ngày/giờ
cũ nhất trước và không tự tạo lesson.

Các trạng thái:

- `UNRECORDED`: chưa có lesson hoặc exception xử lý occurrence.
- `RECORDED`: đã có lesson `DRAFT` hoặc `COMPLETED`.
- `SKIPPED`: occurrence gốc đã được đánh dấu nghỉ.
- `RESCHEDULED`: occurrence gốc đã đổi lịch; một projection thay thế có hậu tố
  khóa `:R` xuất hiện tại ngày/giờ mới và có thể tiếp tục tạo lesson draft.

Nút “Đã dạy” chỉ tạo lesson `DRAFT` qua canonical lesson service để snapshot học
sinh đủ điều kiện. Điểm danh, hoàn thành và phân bổ học phí vẫn diễn ra trong lesson
wizard M2/M3. Tạo draft, nghỉ và đổi lịch đều idempotent với cùng payload.

Bulk create-draft và bulk-skip xử lý độc lập từng occurrence, trả kết quả thành
công/lỗi theo item. Bulk không hoàn thành lesson và không tạo attendance/học phí.

Đổi lịch chỉ áp dụng một occurrence, không sửa lịch lặp. Lịch dạy tại trường/trung
tâm là `teacher_busy_slots.slot_type=EXTERNAL_CLASS`, không tạo class, enrollment,
lesson, attendance hoặc tuition.

Conflict detection dùng khoảng thời gian half-open và trả cảnh báo khi trùng với
projection, lesson (gồm học bù/đổi lịch) hoặc lịch bận. Cảnh báo không âm thầm chặn
nhập dữ liệu lịch sử và không tự thay đổi sự kiện khác.

Lịch bận loại `EXTERNAL_CLASS`, `PERSONAL` hoặc `OTHER` hỗ trợ một lần hoặc lặp
hằng tuần trong khoảng hiệu lực. `EXTERNAL_CLASS` lưu loại và tên đơn vị bên
ngoài. Các mutation lưu actor/audit nhưng không có quan hệ enrollment, attendance
hay tuition.

V14 giữ recurring schedule theo version. PATCH đóng version cũ và tạo row mới;
DELETE chỉ end-date. Projection kết hợp effective range với class active periods,
nên pause/close không làm mất occurrence quá khứ và resume không backfill khoảng
pause. Đổi lịch tạm thời tối đa 45 ngày/20 occurrence dùng preview rồi tạo atomic
RESCHEDULED exceptions, không sửa pattern gốc.

API lịch tuần trả cả occurrence đã đối soát, lesson độc lập (gồm `MAKEUP`) và
busy occurrence đã bung theo ngày. Dashboard dùng cùng projection cho lịch hôm
nay; UI mobile chi tiết nằm trong `daily-operations.md`.

V15 cho phép một request đổi tạm subset 1–7 lịch tuần, tối đa 45 ngày/30
occurrences. Preview kiểm tra cả database và xung đột giữa các mapping; apply là
all-or-nothing. Lịch thay thế có thể tiếp tục nghỉ nhưng exception gốc vẫn là
`RESCHEDULED`; metadata cancellation và entitlement đều quy về canonical key.
