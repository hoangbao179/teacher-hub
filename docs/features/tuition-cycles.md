# Tuition cycles

- Mỗi cycle đúng 8 attendance billable.
- Giá được snapshot khi cycle bắt đầu.
- `ACCUMULATING → PAYMENT_DUE → PAID`.
- Có thể đồng thời tồn tại cycle cũ `PAYMENT_DUE` và cycle mới `ACCUMULATING`.
- V1 chỉ thanh toán toàn bộ đúng `package_price_snapshot`.
- `PAID` là vùng dữ liệu khóa.

Không dùng counter mutable trên student; progress được suy ra từ cycle items.
