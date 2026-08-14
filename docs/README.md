# Documentation map and source of truth

Tài liệu trong repository mô tả trạng thái hiện hành và các quyết định còn hiệu
lực. Lịch sử triển khai nằm trong Git; không tạo report chỉ để liệt kê file, command
hoặc PASS/FAIL.

## Current implementation và context lịch sử

[`implementation/status.md`](implementation/status.md) là canonical **CURRENT
IMPLEMENTATION STATUS**: mô tả hệ thống đang có gì và feature đang ở trạng thái
nào. ADR, product spec và feature doc cũ có thể giữ historical/design context hoặc
mô tả đích ban đầu, không mặc nhiên chứng minh feature đang active. Khi tài liệu cũ
khác implementation hiện tại, phải kiểm tra status và code đang chạy trước khi sửa.

## Thứ tự ưu tiên business/API

1. Business rules trong [`product-spec/`](product-spec/) và ADR accepted trong
   [`decisions/`](decisions/).
2. Acceptance conditions trong product spec hoặc [`features/`](features/) liên
   quan.
3. Contracts trong `../shared/src/`.
4. [`api/openapi.yaml`](api/openapi.yaml).
5. Migration/schema và source hiện tại.
6. Visual references đã duyệt.

Wireframe không ghi đè business rule. PNG P0 là mô tả luồng; screenshot chạy thật
trong [`wireframes/v2-branding/`](wireframes/v2-branding/) và baseline đã duyệt
trong `ui-baselines/`, nếu có, là tham chiếu styling cho màn hình tương ứng.

## Vai trò từng nhóm

- [`product-spec/`](product-spec/): scope, business rules, domain, state machine,
  API logic và acceptance toàn sản phẩm.
- [`features/`](features/): expected behavior, acceptance và regression coverage
  theo feature.
- [`decisions/`](decisions/): ADR cho quyết định kiến trúc/kỹ thuật cần giữ lâu dài.
- [`architecture/`](architecture/): kiến trúc hiện hành và dependency policy.
- [`bug-notes/`](bug-notes/): root cause khó và quy tắc chống tái diễn.
- [`operations/`](operations/): local/production deployment, secrets, OAuth,
  backup/restore, monitoring và rollback.
- [`implementation/status.md`](implementation/status.md): nguồn trạng thái hiện
  hành duy nhất.
- `changes/`: tối đa một consolidated change report cho thay đổi cần
  giữ kiến thức lâu dài; không dùng làm nhật ký mọi task.
- [`wireframes/`](wireframes/) và `ui-baselines/`: chỉ chứa hình đã được reviewer
  hoặc user duyệt.

Artifact kiểm thử tạm thuộc `.artifacts/` và không được commit. `.agent-reports/`
chỉ là đường dẫn tương thích đã ignore, không phải nguồn tài liệu.

## Tài liệu đang có hiệu lực

- [`architecture/dependency-policy.md`](architecture/dependency-policy.md): Node,
  npm và dependency-upgrade rules.
- [`features/student-parent-tracking.md`](features/student-parent-tracking.md):
  legacy Excel và Google Drive/Sheets.
- [`features/vocabulary-assignments-and-games.md`](features/vocabulary-assignments-and-games.md):
  vocabulary catalog, media, assignment, game và result.
- [`design/admin-ui-visual-refresh.md`](design/admin-ui-visual-refresh.md): visual
  target đã duyệt cho Admin Dashboard.

Khi sửa feature quan trọng, cập nhật feature doc và shared contract trong cùng PR.
