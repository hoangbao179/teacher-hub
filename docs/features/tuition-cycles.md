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

## Chronological recalculation

M3 orders mutable billable attendance by `session_date`, effective actual start
(fallback scheduled), scheduled start, lesson ID and attendance ID. It deletes
only non-`PAID` cycles/items and rebuilds full groups of 8 as `PAYMENT_DUE` plus
one optional partial `ACCUMULATING` group. Each group snapshots the effective
policy price on its first attendance date.

The last chronological item in `PAID` history is an immutable boundary. A new
or edited mutable attendance at/before that key returns `PAID_CYCLE_CONFLICT`
and rolls back. Manual approved exclusions use `excluded_from_tuition`; excluded,
ABSENT, per-session FREE and globally FREE attendance never enter a cycle.
