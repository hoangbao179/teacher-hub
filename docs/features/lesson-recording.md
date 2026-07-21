# Lesson recording

## Flow

1. Tạo `lesson_sessions` trạng thái `DRAFT`.
2. Nhập actual time, content, homework và attendance.
3. Draft lưu `lesson_session_participants` snapshot; regular dùng eligibility theo
   `joined_at/ended_at` và active period, makeup dùng danh sách đủ điều kiện được chọn.
4. `LessonService.complete` khóa lesson và participant snapshot trong transaction.
5. Mỗi participant phải có đúng một attendance; attendance ngoài snapshot bị DB từ chối.
6. `PRESENT` của policy trả phí có hiệu lực tại ngày học tạo/cộng cycle item.
7. `ABSENT`, `FREE` và policy miễn phí không cộng.
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

Giờ thực tế không đổi số buổi. Nhập muộn phải dùng `session_date` để xử lý; feature tái phân bổ khi sửa dữ liệu cũ là milestone riêng.

V14 snapshot cả tên/lớp/môn để metadata hiện tại không đổi lịch sử hiển thị. Hủy
draft cần lý do và lưu cancellation metadata. Nếu draft gắn occurrence, cùng
transaction tạo SKIPPED exception. MAKEUP có thể liên kết occurrence nghỉ/hủy;
mapping participant ngăn một enrollment được thay thế hai lần cho cùng nguồn.

V15 dùng mapping như entitlement ledger `OPEN → RESERVED → FULFILLED/WAIVED`.
Hủy draft hoặc bỏ participant release reservation; `PRESENT/FREE` fulfill còn
`ABSENT` trở lại `OPEN`. Correction cập nhật ledger trong cùng transaction.
