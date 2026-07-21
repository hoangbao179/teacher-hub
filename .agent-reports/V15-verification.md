# V15 Verification

## Acceptance

Đạt các acceptance V15 cho schedule, makeup, finance, transfer, UI, tài liệu và bảo toàn lịch sử.

## Combined schedule scenario

PASS: đổi lịch tạm → nghỉ lịch thay thế → học bù sau nhiều tuần; occurrence gốc vẫn `RESCHEDULED`. PASS lớp 1/2/3 lịch, subset, toàn bộ lịch, conflict nội bộ và hết range quay lại lịch gốc.

## Makeup lifecycle

PASS: direct/cancelled source, whole class/subset/nhiều subset, release khi cancel/bỏ participant, `ABSENT`, `PRESENT`, `FREE`, correction và duplicate guard.

## Tuition advance

PASS: receipt trước buổi đầu và tại 3/8, snapshot giá, từ chối `FREE`/partial, `ACCUMULATING` trước 8 và auto `PAID` đúng 8/8.

## Transfer and settlement

PASS: group → one-to-one, capacity rollback, enrollment mới 0/8, `KEEP_OPEN/SETTLE/WAIVE`, receipt transfer/refund/apply và audit.

## Historical integrity

PASS: lesson, attendance, participant snapshot, cycle cũ và PAID boundary không bị viết lại.

## UI/E2E

- `public-homepage.e2e.mjs`: PASS; exact copy, CTA, chips, footer và responsive.
- `schedule-operations.e2e.mjs`: PASS; conflict detail, busy list, multi-schedule, replacement skip, outstanding makeup; không tràn ngang 360/390/430.
- `tuition-management.e2e.mjs`: PASS; thu trước, settlement, transfer, dialog ngừng học/refund; không tràn ngang 360/390/430.
- Toàn bộ `npm run test:e2e` trong `check:full`: PASS.

## Typecheck/lint

`npm run check:full`: shared/server/client typecheck, client lint và production build PASS. Unit: server 45 PASS, client 2 PASS.

## Integration

`npm run test:integration`: 29/29 PASS, gồm migration/schema và các transaction V15.

## OpenAPI

`npm run check:repo`: PASS, 61 Express routes khớp OpenAPI.

## Package hygiene

`npm run package:source` và `npm run check:package`: PASS; 417 entries, SHA-256 `152c3ee46872432acf435aebea810607620a42aa68d1566abb7647975dbdf1f0`. Docker Desktop không khả dụng nên bỏ qua build theo điều kiện của task.

## Final verdict

PASS
