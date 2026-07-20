# Implementation status

## Current milestone

M1.1 — Architecture stabilization.

## Status

PASS. Hoàn tất ngày 20/07/2026. Bằng chứng nằm tại
`.agent-reports/M1.1-implementation.md` và `.agent-reports/M1.1-verification.md`.

## Scope boundary

M1.1 không triển khai lesson-recording wizard, attendance API mới, late-entry
recalculation, makeup-session UI, Excel hoặc notification integrations.

## Known limitations (non-blocking for M1.1)

- Lesson completion UI hiện chỉ là placeholder M2.
- Schedule occurrence resolve/reschedule và makeup controls thuộc milestone sau.
- Tuition mark-paid UI thuộc M4; endpoint nền hiện có nhưng control được disable.
- Homepage contact values chưa cấu hình nên các contact buttons tương ứng bị disable.
