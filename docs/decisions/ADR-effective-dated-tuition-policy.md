# ADR: Effective-dated tuition policy

Status: Approved for future implementation; M1.1 chỉ chốt kiến trúc.

## Decision

Các cột tuition mutable trên enrollment không đủ để xử lý lịch sử. Mọi thay đổi
policy cần effective date; lesson nhập muộn dùng policy có hiệu lực tại
`session_date`. Snapshot của cycle `PAID` không bao giờ thay đổi. Policy mới chỉ
áp dụng cho cycle tương lai đủ điều kiện, không ghi đè snapshot cycle đang khóa.

Schema dự kiến:

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

Khi triển khai, backfill đúng một policy cho mỗi enrollment từ
`tuition_mode`, `custom_package_price` và `COALESCE(tuition_effective_from,
joined_at)`. Sau khi code đọc policy theo ngày và backfill được kiểm chứng, các
cột mutable hiện tại mới được deprecate; không drop trong cùng migration đầu.
Khoảng hiệu lực phải không chồng lấn và `CUSTOM` luôn có giá dương.
