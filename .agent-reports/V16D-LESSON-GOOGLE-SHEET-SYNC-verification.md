# V16D-LESSON-GOOGLE-SHEET-SYNC Verification

## Acceptance

Automated acceptance đạt cho transaction rollback, logical revision race,
canonical row mapping, privacy isolation, resync pending và responsive quick
attendance. Manual Google acceptance chưa có evidence.

## Typecheck/lint

- `npm run typecheck`: đạt.
- `npm -w client run lint`: đạt.
- Build trong `npm run check:full`: đạt.

## Unit/integration/E2E

- `npm run test`: đạt, server 63 pass/41 integration skip; client 27 pass.
- `npm -w server run test:integration`: đạt, 41/41.
- `npm -w client run test:e2e:google-sheet`: đạt tại 360–430 px.
- `npm run test:e2e`: đạt toàn suite.
- `npm run check:full`: đạt sau khi sửa cảnh báo consistency tài liệu.
- `npm run check:repo`: đạt, 69 Express routes khớp OpenAPI.

## Kiểm tra UI thủ công

Targeted Playwright xác minh bulk attendance, comment confirmation, pending/resync
và không overflow. Không có manual browser smoke với Google API thật.

## Tài liệu

Đã cập nhật OpenAPI, database, feature, deployment/troubleshooting, teacher guide,
task, acceptance, roadmap và status. V16E vẫn PLANNED.

## Final verdict

FAIL

Thiếu manual Google production/test smoke bắt buộc: `server/.env` đang
`GOOGLE_DRIVE_ENABLED=false`, `GOOGLE_SHEET_SYNC_ENABLED=false` và có 0/4
credential bắt buộc. Không commit.
