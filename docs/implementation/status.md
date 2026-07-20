# Implementation status

## Current milestone

M2–M3 core learning engine complete. Do not start M4 automatically.

## Status

M1.1: PASS. M2A: PASS. M2B: PASS. M2C: PASS. M3: PASS on 20/07/2026. M2A evidence is in
`.agent-reports/M2A-lesson-domain-implementation.md` and
`.agent-reports/M2A-lesson-domain-verification.md`; M2B evidence is in the
matching `.agent-reports/M2B-lesson-api-*.md` files; M2C evidence is in the
matching `.agent-reports/M2C-lesson-ui-*.md` files.
M3 evidence is in the matching
`.agent-reports/M3-chronological-recalculation-*.md` files.

## Scope boundary

M2A–M3 establish historical domain/contracts, transactional lesson APIs, mobile
wizard and chronological mutable-cycle recalculation with immutable PAID boundary.
Payment/tuition-management UI remains M4 and is not implemented here.

## Known limitations (non-blocking for M1.1)

- Lesson completion UI hiện chỉ là placeholder M2.
- Schedule occurrence resolve/reschedule và makeup controls thuộc milestone sau.
- Tuition mark-paid UI thuộc M4; endpoint nền hiện có nhưng control được disable.
- Homepage contact values chưa cấu hình nên các contact buttons tương ứng bị disable.
