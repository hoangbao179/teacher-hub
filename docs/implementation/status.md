# Implementation status

## Current milestone

M4 tuition operations and M5A schedule/reconciliation backend are complete; M5B
dashboard and operations UI is the next approved checkpoint.

## Status

M1.1: PASS. M2A: PASS. M2B: PASS. M2C: PASS. M3: PASS on 20/07/2026. M2A evidence is in
`.agent-reports/M2A-lesson-domain-implementation.md` and
`.agent-reports/M2A-lesson-domain-verification.md`; M2B evidence is in the
matching `.agent-reports/M2B-lesson-api-*.md` files; M2C evidence is in the
matching `.agent-reports/M2C-lesson-ui-*.md` files.
M3 evidence is in the matching
`.agent-reports/M3-chronological-recalculation-*.md` files.
M4A: PASS on 20/07/2026. Evidence is in
`.agent-reports/M4A-tuition-api-implementation.md` and
`.agent-reports/M4A-tuition-api-verification.md`.
M4B: PASS on 20/07/2026. Evidence is in
`.agent-reports/M4B-tuition-ui-implementation.md` and
`.agent-reports/M4B-tuition-ui-verification.md`.
M5A: PASS on 20/07/2026. Evidence is in
`.agent-reports/M5A-schedule-reconciliation-api-implementation.md` and
`.agent-reports/M5A-schedule-reconciliation-api-verification.md`.

## Scope boundary

M2A–M3 establish historical domain/contracts, transactional lesson APIs, mobile
wizard and chronological mutable-cycle recalculation with immutable PAID boundary.
Tuition query/payment APIs and enrollment-ending `INCOMPLETE` behavior are M4A.
Tuition-management UI and mobile payment flow are M4B.
M5A adds deterministic projected occurrences, exceptions, canonical draft
creation, busy slots, conflict warnings and per-item bulk reconciliation.

## Known limitations

- Dashboard, reconciliation and calendar UI remain M5B.
- Makeup UI entry points from dashboard/class/calendar remain M5B.
- Homepage contact values chưa cấu hình nên các contact buttons tương ứng bị disable.
