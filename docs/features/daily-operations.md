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

`/admin/calendar` is a chronological mobile week list. It shows recurring and
replacement projections, recorded/draft/completed lessons, makeup lessons,
skipped originals and expanded one-time/weekly busy slots. Week navigation changes
only the projection window; no drag/drop mutation exists in V1.

`/admin/busy-slots/new` and `/admin/busy-slots/{id}/edit` manage teacher-only
availability. Conflict warnings are visible but non-blocking. The form exposes no
student, attendance or tuition fields.

Dashboard, class detail and calendar link “Buổi học bù” to the existing M2 lesson
wizard with `MAKEUP` preselected. The wizard still requires explicit participants.
