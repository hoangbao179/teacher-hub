# Daily operations UI

`/admin` composes one efficient Dashboard response. Tuition count/amount comes
from the M4 SQL summary; unrecorded count comes from the configured schedule
lookback; today's schedule includes reconciled occurrences, standalone lessons
(including makeup) and expanded busy-slot occurrences. The browser never derives
or increments tuition.

`/admin/reconciliation` is the operational surface for M5A occurrences. It
supports date/class/state filters, single create-draft/skip/reschedule and
multi-select draft/skip. “Đã dạy” follows the server-returned lesson wizard path;
bulk results remain independent and no UI action bulk-completes lessons.
Occurrence queries clamp the start date to today in Asia/Ho_Chi_Minh minus
`lookbackDays` (default 14, maximum 60), even when an older explicit range is
requested. Schedule integration fixtures use a test-scoped fixed Date clock;
their July–September 2026 dates must not age out as nightly regression runs.
Trên mobile, filter đã áp dụng được tóm tắt trong một thanh gọn; bốn field chỉnh sửa
nằm trong bottom sheet và chỉ gọi lại dữ liệu khi chọn **Áp dụng**. Khi chưa chọn
buổi, màn hình chỉ hiện **Chọn tất cả**; khi có lựa chọn, hai bulk action hiện trong
thanh cố định phía trên bottom navigation. Desktop tiếp tục hiển thị filter đầy đủ.

`/admin/calendar` is a chronological mobile week list. It shows recurring and
replacement projections, recorded/draft/completed lessons, makeup lessons,
skipped originals and expanded one-time/weekly busy slots. Week navigation changes
only the projection window; no drag/drop mutation exists in V1.

`/admin/busy-slots/new` and `/admin/busy-slots/{id}/edit` manage teacher-only
availability, including external school/center teaching schedules. Calendar offers
an “Thêm lịch” menu for external teaching or personal busy time; weekly forms edit
all child schedules in one save. Calendar and Dashboard label school, center and personal
items. Conflict warnings are visible but non-blocking. The form exposes no student,
attendance or tuition fields.

Calendar action hierarchy keeps one full-width primary lesson action on mobile,
two half-width secondary actions below it and the reconciliation link as a low-priority
text action. Desktop keeps the same actions compact on one row.

Dashboard, class detail and calendar link “Buổi học bù” to the existing M2 lesson
wizard with `MAKEUP` preselected. The wizard still requires explicit participants.

Occurrence SKIPPED hiển thị lý do và mở wizard với nguồn học bù. Học sinh đã có
replacement cho nguồn đó bị khóa. Conflict preflight dùng chung cho lesson, draft,
reschedule và busy slot; cảnh báo có text/icon và không tự thay đổi lịch khác.

The admin shell is branded “Lớp học cô Vy”. On mobile its five equal-width primary
actions are Hôm nay, Lịch, Lớp học, Học phí and Học sinh; labels keep one size and
one line, while the person icon identifies Học sinh. The fixed navigation and sticky
actions include bottom safe-area spacing. Desktop keeps the permanent sidebar.

Dashboard greeting comes from the authenticated display name and all metric values
remain server-authoritative. Lavender, mint and blue distinguish the three metrics
without changing their priority or links. Student cards render only returned data:
full name, optional nickname, class, Vietnamese state and current tuition progress.

V15 thêm `/admin/makeup-outstanding` không giới hạn lookback và
`/admin/busy-slots`. Calendar giữ toàn bộ conflict; dialog giải thích loại, đối
tượng và ngày/giờ trùng thay vì chỉ hiển thị icon.
