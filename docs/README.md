# Documentation source of truth

Đọc theo thứ tự:

1. `product-spec/03-business-rules.md`
2. `features/` theo module đang sửa
3. `product-spec/09-acceptance-tests.md`
4. `architecture/`
5. `decisions/`
6. `wireframes/`

Wireframe không được dùng để ghi đè business rule. Nội dung Home do developer sửa trong source, không có CMS V1. Excel migration tạm hoãn; file cũ chỉ nằm trong `reference/legacy-excel/`.

Khi thêm/sửa feature quan trọng, cập nhật tài liệu feature và shared contract trong cùng PR.

- `architecture/dependency-policy.md`: Node/npm baseline and dependency-upgrade rules.
