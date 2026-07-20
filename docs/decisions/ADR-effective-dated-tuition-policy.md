# ADR: Effective-dated tuition policy

Status: Approved and selected for implementation in M2A.

## Decision

Các cột tuition mutable trên enrollment không đủ để xử lý lịch sử. Mọi thay đổi
policy cần effective date; lesson nhập muộn dùng policy có hiệu lực tại
`session_date`. Snapshot của cycle `PAID` không bao giờ thay đổi. Policy mới chỉ
áp dụng cho cycle tương lai đủ điều kiện, không ghi đè snapshot cycle đang khóa.

## Selected design

M2A uses two normalized histories:

```text
class_tuition_policies
- id
- class_id
- package_price
- effective_from
- effective_to
- created_at
- created_by

enrollment_tuition_policies
- id
- enrollment_id
- tuition_mode
- custom_package_price
- effective_from
- effective_to
- created_at
- created_by
```

`CLASS_DEFAULT` is resolved in two explicit steps for the lesson date: first the
enrollment policy selects `CLASS_DEFAULT`, then the class policy effective on the
same date supplies the package price. `CUSTOM` resolves its own positive price;
`FREE` resolves no price. This makes historical class-default pricing independent
of the mutable `classes.default_package_price` column.

Policy ranges are inclusive, non-overlapping date ranges. A new policy closes the
previous range on the prior date inside the same transaction. Class price edits
without an explicit date become effective on the edit date in
`Asia/Ho_Chi_Minh`; enrollment mode edits use the API's `effectiveFrom`.

The mutable class/enrollment columns remain compatibility projections during
M2/M3 and are not the source for historical allocation.

Previous proposed schema:

```text
enrollment_tuition_policies
- id
- enrollment_id
- tuition_mode
- custom_package_price
- effective_from
- effective_to
- created_at
- created_by
```

## Migration strategy

M2A backfills exactly one class policy from `classes.start_date` and current
default price, and exactly one enrollment policy from
`tuition_mode`, `custom_package_price` và `COALESCE(tuition_effective_from,
joined_at)`. Sau khi code đọc policy theo ngày và backfill được kiểm chứng, các
cột mutable hiện tại mới được deprecate; không drop trong cùng migration đầu.
Khoảng hiệu lực phải không chồng lấn và `CUSTOM` luôn có giá dương.
