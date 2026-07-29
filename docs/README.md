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

Đợt refresh giao diện Admin đã được duyệt về thiết kế nhưng chưa triển khai. Xem
[`design/admin-ui-visual-refresh.md`](design/admin-ui-visual-refresh.md); ba ảnh
Playwright approved trong `wireframes/admin-ui-refresh/` là visual target mới cho
Admin Dashboard. Thứ tự ưu tiên của business rules, contracts và source code ở
trên không thay đổi.

Khi thêm/sửa feature quan trọng, cập nhật tài liệu feature và shared contract trong cùng PR.

V16B đã có preview/row resolution/apply legacy Excel vào MySQL. V16C đã có OAuth,
Drive/Sheets provider, một Sheet Restricted theo student và regenerate thủ công.
Auto-sync/sharing vẫn thuộc V16D–V16E **PLANNED**. Source of truth là
`features/student-parent-tracking.md`.

`implementation/status.md` là nguồn trạng thái triển khai duy nhất được commit. `BASE_STATUS.md`
chỉ là con trỏ tương thích; không duy trì file manifest thủ công.

- `architecture/dependency-policy.md`: Node/npm baseline and dependency-upgrade rules.
- `features/vocabulary-assignments-and-games.md`: source of truth đã harden cho
  feature **IMPLEMENTED** V20A–V20E về chủ đề, bộ từ, Pixabay/media, giao bài, game và
  kết quả mobile-first.
