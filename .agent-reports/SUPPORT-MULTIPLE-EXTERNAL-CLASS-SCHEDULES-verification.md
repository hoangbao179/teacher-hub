# SUPPORT-MULTIPLE-EXTERNAL-CLASS-SCHEDULES Verification

## Acceptance

Đạt toàn bộ acceptance về multi-schedule, backfill, transaction, projection/conflict, UI hierarchy và không tác động nghiệp vụ lớp/học phí.

## Typecheck/lint

`npm run check:full` — typecheck và lint PASS.

## Unit/integration/E2E

- Server unit PASS; 32 integration tests PASS, gồm backfill, 2/4 schedules, add/remove, duplicate, rollback, cascade và bất biến bảng nghiệp vụ.
- Toàn bộ E2E PASS; Calendar targeted xác nhận nhiều occurrence cùng parent và menu mới.

## Kiểm tra UI thủ công

Playwright kiểm tra Calendar tại 390×844, 768×1024 và 1440×900, không horizontal scroll.

## Tài liệu

Contracts, OpenAPI, product/domain/scheduling/database/status đã đồng bộ.

## Final verdict

PASS
