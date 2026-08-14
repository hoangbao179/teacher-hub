# Lesson recording

## Flow

1. Tạo `lesson_sessions` trạng thái `DRAFT`.
2. Nhập actual time, content, homework và attendance.
3. Draft lưu `lesson_session_participants` snapshot; regular dùng eligibility theo
   `joined_at/ended_at` và active period, makeup dùng danh sách đủ điều kiện được chọn.
4. `LessonService.complete` khóa lesson và participant snapshot trong transaction.
5. Mỗi participant phải có đúng một attendance; attendance ngoài snapshot bị DB từ chối.
6. `PRESENT` của policy trả phí có hiệu lực tại ngày học tạo/cộng cycle item.
7. Chỉ `PRESENT` cộng buổi học phí; `ABSENT`, `FREE` và policy miễn phí không cộng.
8. Item thứ 8 chuyển cycle sang `PAYMENT_DUE`.

## Canonical API and lesson types

M2B exposes only `/api/lessons`: create/detail/update, participant, attendance,
content, complete and cancel. `REGULAR` snapshots every eligible enrollment.
`MAKEUP` and `EXTRA` both require an explicit non-empty selected participant
list; this prevents an extra lesson from silently affecting every enrollment.

Completion locks the draft, participant/enrollment policy rows and cycle rows in
one transaction. A concurrent/repeated request that observes `COMPLETED` returns
the persisted result without inserting attendance or cycle items again.

## Mobile wizard

M2C implements four visible steps at `/admin/lessons/new` and
`/admin/lessons/:id/edit`. Step transitions persist to the server. Paid policies
default to `PRESENT`; global `FREE` defaults to `FREE` and cannot select billable
PRESENT. Confirmation separates scheduled/actual time and states that duration
does not change tuition count. Success shows per-enrollment progress impact.

M3 permits transaction-safe corrections to completed session date/actual time,
attendance and explicitly resubmitted participant snapshots. Every tuition
affecting edit recalculates all affected enrollments before commit. A paid item
or a chronological crossing of the paid boundary returns `PAID_CYCLE_CONFLICT`;
the wizard shows the conflict and retains persisted data.

### Simple Mode cho buổi học hằng ngày

Dashboard `Hôm nay` là happy path cho occurrence thường: buổi chưa ghi tạo draft
bằng API schedule hiện hành rồi mở `/admin/lessons/:id/edit?mode=quick`; draft đã
có được mở lại cùng mode và buổi hoàn thành không tạo draft mới. Lịch dạy ngoài và
lịch bận chỉ xuất hiện trên timeline. Reconciliation vẫn giữ cho lịch cũ và ngoại lệ.

Quick mode chỉ được bật khi lesson đang là `DRAFT`, loại `REGULAR`, liên kết đúng
occurrence lịch thường và không thuộc ca học ghép. Tạo thủ công, `MAKEUP`, `EXTRA`,
combined class và mọi case không chứng minh được điều kiện trên dùng wizard bốn
bước. Link `Chỉnh sửa đầy đủ` giữ nguyên lesson id và chuyển về wizard đó.

Quick form mặc định paid enrollment là `PRESENT`, enrollment `FREE` là `FREE`, chỉ
đưa lựa chọn Có mặt/Nghỉ lên bề mặt chính và gửi một request `complete` chứa giờ
thực tế, attendance, content, homework, nhận xét và note. Backend vẫn là nơi kiểm
tra validation, conflict, tuition transaction và enqueue Google Sheet outbox.

Giờ thực tế không đổi số buổi. Nhập muộn phải dùng `session_date` để xử lý; feature tái phân bổ khi sửa dữ liệu cũ là milestone riêng.

V14 snapshot cả tên/lớp/môn để metadata hiện tại không đổi lịch sử hiển thị. Hủy
draft cần lý do và lưu cancellation metadata. Nếu draft gắn occurrence, cùng
transaction tạo SKIPPED exception. MAKEUP có thể liên kết occurrence nghỉ/hủy;
mapping participant ngăn một enrollment được thay thế hai lần cho cùng nguồn.

V15 dùng mapping như entitlement ledger `OPEN → RESERVED → FULFILLED/WAIVED`.
Hủy draft hoặc bỏ participant release reservation; `PRESENT/FREE` fulfill còn
`ABSENT` trở lại `OPEN`. Correction cập nhật ledger trong cùng transaction.

## Nhận xét và Google sync — IMPLEMENTED V16D

Runtime lưu `content`, `homework`, `general_comment` một lần tại lesson,
`note` nội bộ và `student_note` riêng theo participant. `ABSENT` vẫn thấy
ngày/content/homework nhưng không mặc định nhận general
performance comment. Action chuyển note riêng thành chung phải mang nhãn
`Dùng làm nhận xét chung cho cả lớp`, không ghi đè note riêng khác và không tự áp
dụng cho mọi student.

Khi lesson đã hoàn thành được tạo hoặc sửa, service ghi outbox trong cùng transaction
sau tuition recalculation. Worker nền đồng bộ snapshot mới nhất sau commit; Google
lỗi không rollback lesson, attendance hoặc tuition. Chi tiết privacy/retry/resync
nằm trong `student-parent-tracking.md`.
