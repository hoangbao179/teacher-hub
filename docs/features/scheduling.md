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
hằng tuần trong khoảng hiệu lực. Một parent `WEEKLY` có một hoặc nhiều row
`teacher_busy_slot_schedules`; mỗi row được bung occurrence và kiểm tra conflict
độc lập. `EXTERNAL_CLASS` lưu loại và tên đơn vị bên ngoài. Mutation parent và
danh sách lịch con nằm trong cùng transaction, nhưng không có quan hệ enrollment,
attendance hay tuition.

V14 giữ recurring schedule theo version. PATCH đóng version cũ và tạo row mới;
DELETE chỉ end-date. Projection kết hợp effective range với class active periods,
nên pause/close không làm mất occurrence quá khứ và resume không backfill khoảng
pause. Đổi lịch tạm thời tối đa 45 ngày/20 occurrence dùng preview rồi tạo atomic
RESCHEDULED exceptions, không sửa pattern gốc.

API lịch tuần trả cả occurrence đã đối soát, lesson độc lập (gồm `MAKEUP`) và
busy occurrence đã bung theo ngày. Dashboard dùng cùng projection cho lịch hôm
nay; UI mobile chi tiết nằm trong `daily-operations.md`.

Calendar Simple Mode tiếp tục gom lớp riêng, lịch trường, lịch trung tâm, lịch cá
nhân, buổi đổi lịch và học bù trên cùng timeline, đồng thời gắn nhãn loại lịch rõ
ràng. Bề mặt chính chỉ có action “Thêm”; lịch ngoài, buổi ghi thủ công và học bù
nằm trong menu này. Đối soát tuần vẫn truy cập được bằng action phụ. Việc ghi buổi
hằng ngày bắt đầu từ Dashboard; lịch trường/trung tâm vẫn chỉ là busy slot có thể
xem/sửa và không tạo attendance, tuition hay student.

Client theo dõi ngày hiện tại tại `Asia/Ho_Chi_Minh` bằng một timeout tới ngay sau
00:00 và kiểm tra lại khi tab visible, cửa sổ focus hoặc page resume. Khi ngày đổi,
Dashboard ẩn snapshot cũ rồi tải lại toàn bộ response; Calendar chỉ chuyển tuần nếu
người dùng vẫn chọn chế độ bám tuần hiện tại; Reconciliation chỉ dịch các biên ngày
mặc định chưa được người dùng sửa. Response từ request cũ không được ghi đè state
sau khi query ngày/tuần đã đổi.

Occurrence học ghép đã có `combinedTeachingOccurrenceId` luôn mở occurrence cha;
`linkedLessonId` của lesson con không được dùng làm đích từ Dashboard hoặc Calendar.
Occurrence nhóm chưa tạo draft tiếp tục mở Reconciliation để tạo occurrence cha theo
canonical flow.

V15 cho phép một request đổi tạm subset 1–7 lịch tuần, tối đa 45 ngày/30
occurrences. Preview kiểm tra cả database và xung đột giữa các mapping; apply là
all-or-nothing. Lịch thay thế có thể tiếp tục nghỉ nhưng exception gốc vẫn là
`RESCHEDULED`; metadata cancellation và entitlement đều quy về canonical key.
