# V20C Vocabulary Assignments Implementation

## Phạm vi

Assignment `DRAFT → PUBLISHED → CLOSED`, ba audience, snapshot publish, share token/QR
và giao diện quản trị responsive.

## Vấn đề đã sửa

- Thêm migration `0018`, transaction publish, optimistic version và state guards.
- Raw token chỉ trả một lần; DB chỉ lưu SHA-256. Có revoke/regenerate/close/duplicate.
- Materialize public learning asset thành stored WebP trước transaction.
- Thêm list, wizard 6 bước, preview và detail/share trên mobile/desktop.

## File chính đã đổi

`shared/src/contracts/assignments.ts`, `server/src/services/assignment.service.ts`,
`server/src/repositories/assignment.repository.ts`,
`client/src/features/assignments/`, `docs/api/openapi.yaml`.

## API/schema thay đổi

Thêm migration `0018` và protected routes `/api/vocabulary/assignments`.
Không thêm public gameplay/attempt/result API.

## Kiểm tra đã chạy

Typecheck, lint, build, unit, integration, targeted E2E và full gate.

## Điểm còn lại

Public game runtime và kết quả thuộc V20D–V20E.

## Commit

`feat(vocabulary): add assignment creation and publishing workflow`
