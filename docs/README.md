# Documentation source of truth

Đọc theo thứ tự:

1. Business rules trong `product-spec/` và ADR đã approved trong `decisions/`.
2. Acceptance criteria trong `product-spec/09-acceptance-tests.md` và `implementation/acceptance/`.
3. Contracts trong `../shared/src/contracts/`.
4. `api/openapi.yaml`.
5. Migration/schema và source hiện tại.
6. `wireframes/`.

Wireframe không được dùng để ghi đè business rule. PNG P0 là lịch sử workflow;
screenshot chạy thật trong `wireframes/v2-branding/` là tham chiếu styling hiện
hành cho màn hình tương ứng. Nội dung Home do developer sửa trong source, không có
CMS V1. Excel migration tạm hoãn; file cũ chỉ nằm trong `reference/legacy-excel/`.

Khi thêm/sửa feature quan trọng, cập nhật tài liệu feature và shared contract trong cùng PR.

`implementation/status.md` là nguồn trạng thái triển khai duy nhất được commit. `BASE_STATUS.md`
chỉ là con trỏ tương thích; không duy trì file manifest thủ công.

- `architecture/dependency-policy.md`: Node/npm baseline and dependency-upgrade rules.
