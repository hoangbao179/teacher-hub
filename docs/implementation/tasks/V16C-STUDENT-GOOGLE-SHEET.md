# V16C-STUDENT-GOOGLE-SHEET

Trạng thái: **PLANNED**

## Goal

Tích hợp OAuth/Drive/Sheets để tạo một Google Sheet `ACTIVE` chuyên nghiệp cho
mỗi student và cho phép mở/copy link từ Student Detail.

## In scope

- OAuth server-side, quản lý token an toàn và provider abstraction.
- Tạo template `Tổng quan`, `Nhật ký học tập`, `Học phí`, `_TeacherHub` theo feature spec.
- Unique invariant tối đa một Sheet `ACTIVE` theo student; Sheet thuộc tài khoản cô Vy.
- Lưu spreadsheet ID/URL/status/schema version; archive/replace có audit.
- Student Detail hiển thị trạng thái, mở link, copy link và tạo Sheet khi chưa có.
- Responsive 360–430 px; action thật, không có nút giả.
- Fake Google provider cho integration tests.

## Out of scope

- Chưa tự động sync lesson hoặc tuition.
- Chưa chia sẻ parent Viewer.
- Không convert/upload workbook legacy gốc.

## Required reading

- `docs/features/student-parent-tracking.md`
- `docs/security/security-notes.md`
- `docs/security/data-exposure.md`
- Contracts/student source và hướng dẫn production secrets.

## Acceptance criteria

- Concurrent/repeated create trả cùng ACTIVE Sheet; không tạo duplicate.
- Credential không xuất hiện trong Sheet, response client, log hoặc audit payload.
- Template/schema/mapping đúng; Sheet gắn student, không gắn class.
- Google failure không rollback dữ liệu nghiệp vụ và được biểu diễn an toàn cho admin.
- Student Detail mở/copy đúng URL và hoạt động không overflow ở 360–430 px.

## Files likely affected khi triển khai

Migration mới, Google provider/config, external-resource service/repository/outbox
nếu cần, student contracts/API, Student Detail và test.

## Verification commands khi triển khai

```bash
npm run build:shared
npm -w server run typecheck
npm -w server run test
npm run test:integration
npm -w client run typecheck
npm -w client run lint
npm run check:full
```

Manual production smoke dùng tài khoản Google của cô Vy và một student test không
chứa dữ liệu thật trước khi bật cho production.
