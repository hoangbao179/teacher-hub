# Tuition cycles

- Mỗi cycle đúng 8 attendance billable.
- Giá được snapshot khi cycle bắt đầu.
- `ACCUMULATING → PAYMENT_DUE → PAID`.
- Có thể đồng thời tồn tại cycle cũ `PAYMENT_DUE` và cycle mới `ACCUMULATING`.
- V1 chỉ thanh toán toàn bộ đúng `package_price_snapshot`.
- `PAID` là vùng dữ liệu khóa.
- Mode enrollment và giá mặc định lớp được lưu thành hai lịch sử effective-dated.
  `CLASS_DEFAULT` của lesson lịch sử lấy giá class policy cùng `session_date`;
  `CUSTOM` lấy giá riêng của enrollment policy; `FREE` không có giá/cycle.

Không dùng counter mutable trên student; progress được suy ra từ cycle items.

## Query and payment management

M4A exposes the canonical route family:

- `GET /api/tuition-cycles`: pagination plus status, class, student,
  enrollment, name and lifecycle-date filters. `OLDEST_DUE` is the default;
  `NEWEST` and `STUDENT_NAME` are also deterministic.
- `GET /api/tuition-cycles/summary`: SQL aggregate for current due count/amount,
  accumulating enrollments and paid cycles in an optional payment-date period.
- `GET /api/tuition-cycles/:id`: direct cycle lookup plus stored item sequence;
  it does not load every cycle and filter in application memory.
- `POST /api/tuition-cycles/:id/mark-paid`: locks the cycle and its items, requires
  `PAYMENT_DUE`, exactly eight items and the exact snapshot amount, then writes
  payment fields and `TUITION_CYCLE_MARKED_PAID` in one transaction.

An identical payment replay returns the persisted result with
`idempotent=true`. Different payment data for an already-paid cycle returns
`PAYMENT_CONFLICT` (HTTP 409). Marking one cycle paid never updates a later
accumulating cycle.

## Mobile management UI

M4B implements `/admin/tuition`, `/admin/tuition/:cycleId` and
`/admin/tuition/:cycleId/mark-paid`. The list uses four status tabs, server-side
search/class/sort/pagination and card layouts. Detail renders the exact stored
item order with scheduled/actual time, duration and lesson type.

Only `PAYMENT_DUE` shows the payment action. The payment form defaults to the
snapshot amount, rejects any different amount, requires a confirmation dialog
and disables the final action while the request is pending. A successful
mutation navigates to freshly loaded read-only `PAID` detail; returning to the
list also refetches server data.

## Enrollment ending

Ending an enrollment locks its cycles and changes only an `ACCUMULATING`
partial cycle to `INCOMPLETE`. `PAYMENT_DUE` and `PAID` cycles and their items
remain byte-stable. Historical billable attendances stay visible and no amount
becomes due for the incomplete cycle.

An `ENDED` enrollment cannot be resumed. If the student returns, the teacher
creates a new enrollment; because cycles belong to an enrollment, that new
enrollment starts its own cycle numbering and does not reopen the old
`INCOMPLETE` cycle.

## Chronological recalculation

M3 orders mutable billable attendance by `session_date`, effective actual start
(fallback scheduled), scheduled start, lesson ID and attendance ID. It deletes
only non-`PAID` cycles/items and rebuilds full groups of 8 as `PAYMENT_DUE` plus
one optional partial `ACCUMULATING` group. Each group snapshots the effective
policy price on its first attendance date.

When recalculation is legitimately invoked for an already-ended enrollment,
its final partial mutable group is rebuilt as `INCOMPLETE`, not `ACCUMULATING`.

The last chronological item in `PAID` history is an immutable boundary. A new
or edited mutable attendance at/before that key returns `PAID_CYCLE_CONFLICT`
and rolls back. Manual approved exclusions use `excluded_from_tuition`; excluded,
ABSENT, per-session FREE and globally FREE attendance never enter a cycle.
