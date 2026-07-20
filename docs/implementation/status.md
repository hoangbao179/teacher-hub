# Implementation status

## Current milestone

M6 release-candidate preparation is complete. M6A through M6D are PASS and the
artifact is `RELEASE_CANDIDATE_READY` for a separate full-system review. It is
not production-approved.

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
M6A: PASS on 21/07/2026. Evidence is in
`.agent-reports/M6A-public-homepage-implementation.md` and
`.agent-reports/M6A-public-homepage-verification.md`.
M6B: PASS on 21/07/2026. Evidence is in
`.agent-reports/M6B-excel-export-implementation.md` and
`.agent-reports/M6B-excel-export-verification.md`.
M6C: PASS on 21/07/2026. Evidence is in
`.agent-reports/M6C-ui-accessibility-performance-implementation.md` and
`.agent-reports/M6C-ui-accessibility-performance-verification.md`.
M6D: PASS on 21/07/2026. Evidence is in
`.agent-reports/M6D-production-readiness-implementation.md` and
`.agent-reports/M6D-production-readiness-verification.md`.

## Scope boundary

M2A–M3 establish historical domain/contracts, transactional lesson APIs, mobile
wizard and chronological mutable-cycle recalculation with immutable PAID boundary.
Tuition query/payment APIs and enrollment-ending `INCOMPLETE` behavior are M4A.
Tuition-management UI and mobile payment flow are M4B.
M5A adds deterministic projected occurrences, exceptions, canonical draft
creation, busy slots, conflict warnings and per-item bulk reconciliation.
M5B adds real Dashboard aggregates/today schedule, mobile reconciliation,
weekly calendar, busy-slot management and makeup entry points. M6A adds the
public marketing Homepage, content configuration, SEO, lazy media and public
mobile/accessibility/performance coverage. M6B adds authenticated canonical
per-student Excel reporting, export audit and safe browser download.
M6C standardizes the mobile design system, Vietnamese terminology, accessibility
states, protected/public navigation and responsive UI regression coverage.
M6D adds production configuration validation, operational security/lifecycle,
Docker/CI, backup/restore and release documentation.

## Known limitations

- Generic Excel import remains deferred beyond V1 as a separate controlled
  legacy-migration task.
- Desktop drag/drop calendar is outside V1; the approved mobile week list is complete.
- Production-specific public teacher/contact/domain values must replace the
  fictional source defaults before a real deployment.
