# V16B-LEGACY-IMPORT-APPLY Verification

## Acceptance

PASS: review/resolve/skip/apply, exact lesson reuse, multi-student attendance isolation, idempotent replay, audit và cycle liên enrollment.

## Typecheck/lint

- `npm run typecheck`: PASS.
- `npm -w client run lint`: PASS.

## Unit/integration/E2E

- `npm run test`: PASS.
- `npm -w server run test:integration`: PASS, 36/36.
- `npm run test:e2e`: PASS; legacy Apply và không overflow tại 360–430 px.
- Workbook thật đã ẩn danh trong restricted environment: parser/reconciliation smoke PASS; không lưu artifact.

## Kiểm tra UI thủ công

Review theo card mobile, mapping, payment decision, confirmation, kết quả và CTA hoạt động; không có page-level horizontal scroll.

## Tài liệu

Đã cập nhật OpenAPI, database, product/feature spec, user guide, task, acceptance, roadmap và status.

## Final verdict

PASS
