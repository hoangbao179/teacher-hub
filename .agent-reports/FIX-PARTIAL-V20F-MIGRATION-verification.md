# FIX-PARTIAL-V20F-MIGRATION Verification

## Acceptance

Đạt đủ recovery `0021`, recovery `0022`, fresh migration và giữ nguyên migration đã phát hành.

## Typecheck/lint

- `npm -w server run typecheck`: PASS.
- Typecheck và lint trong `npm run check:full`: PASS.

## Unit/integration/E2E

- `npm -w server run test`: PASS, 161 pass và 77 integration skip theo thiết kế.
- `npm run test:integration`: PASS, scenario recovery và 77/77 integration test.
- `npm run check:full`: PASS sau 544 giây, gồm toàn bộ E2E.

## Kiểm tra UI thủ công

Không áp dụng; task chỉ thay đổi migration runner.

## Tài liệu

Task, acceptance và hướng dẫn backup/recovery đã cập nhật.

## Final verdict

PASS
