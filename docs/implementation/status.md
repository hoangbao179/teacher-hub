# Implementation status

## Current milestone

M4 tuition operations and M5 schedule/dashboard operations are complete. The
M4–M5 task group is closed; do not start M6 automatically.

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
M5B: PASS on 20/07/2026. Evidence is in
`.agent-reports/M5B-dashboard-schedule-ui-implementation.md` and
`.agent-reports/M5B-dashboard-schedule-ui-verification.md`.

## Scope boundary

M2A–M3 establish historical domain/contracts, transactional lesson APIs, mobile
wizard and chronological mutable-cycle recalculation with immutable PAID boundary.
Tuition query/payment APIs and enrollment-ending `INCOMPLETE` behavior are M4A.
Tuition-management UI and mobile payment flow are M4B.
M5A adds deterministic projected occurrences, exceptions, canonical draft
creation, busy slots, conflict warnings and per-item bulk reconciliation.
M5B adds real Dashboard aggregates/today schedule, mobile reconciliation,
weekly calendar, busy-slot management and makeup entry points.

## Known limitations

- M6 homepage polish and Excel export/import are not implemented.
- Desktop drag/drop calendar is outside V1; the approved mobile week list is complete.
- Production client build retains a non-failing chunk-size warning.
- Homepage contact values chưa cấu hình nên các contact buttons tương ứng bị disable.
