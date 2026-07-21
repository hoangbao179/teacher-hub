# Implementation status

## Current milestone

M1–M6, V1.1, all V1.2 checkpoints V12A–V12E, V13 and V14 are PASS.
The release-candidate artifact is not a production approval; real operator
configuration is still required. **Independent full-system review: NOT STARTED.**

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
UIA: PASS on 21/07/2026. Evidence is in
`.agent-reports/UIA-implementation.md` and
`.agent-reports/UIA-verification.md`.
UIB: PASS on 21/07/2026. Evidence is in
`.agent-reports/UIB-implementation.md`,
`.agent-reports/UIB-verification.md` and
`.agent-reports/UIB-visual-review.md`.
UIC: PASS on 21/07/2026. Evidence is in
`.agent-reports/UIC-implementation.md` and
`.agent-reports/UIC-verification.md`.
UID: PASS on 21/07/2026. Evidence is in
`.agent-reports/UID-implementation.md` and
`.agent-reports/UID-verification.md`.
V11A: PASS on 21/07/2026. Evidence is in
`.agent-reports/V11A-implementation.md` and `.agent-reports/V11A-verification.md`.
V11B: PASS on 21/07/2026. Evidence is in
`.agent-reports/V11B-implementation.md` and `.agent-reports/V11B-verification.md`.
V11C: PASS on 21/07/2026. Evidence is in
`.agent-reports/V11C-implementation.md` and `.agent-reports/V11C-verification.md`.
V11D: PASS on 21/07/2026. Evidence is in
`.agent-reports/V11D-implementation.md` and `.agent-reports/V11D-verification.md`.
V11E: PASS on 21/07/2026. Evidence is in
`.agent-reports/V11E-implementation.md` and `.agent-reports/V11E-verification.md`.
V12A: PASS on 21/07/2026. Evidence is in
`.agent-reports/V12A-implementation.md` and `.agent-reports/V12A-verification.md`.
V12B: PASS on 21/07/2026. Evidence is in
`.agent-reports/V12B-implementation.md` and `.agent-reports/V12B-verification.md`.
V12C: PASS on 21/07/2026. Evidence is in
`.agent-reports/V12C-implementation.md` and `.agent-reports/V12C-verification.md`.
V12D: PASS on 21/07/2026. Evidence is in
`.agent-reports/V12D-implementation.md` and `.agent-reports/V12D-verification.md`.
V12E: PASS on 21/07/2026. Evidence is in
`.agent-reports/V12E-implementation.md` and `.agent-reports/V12E-verification.md`.
V13: PASS on 21/07/2026. Evidence is in
`.agent-reports/V13-implementation.md` and `.agent-reports/V13-verification.md`.
V14: PASS on 21/07/2026. Evidence is in
`.agent-reports/V14-implementation.md` and `.agent-reports/V14-verification.md`.

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
V13 completes the responsive public Homepage, compact mobile management flows,
plain-language admin labels, stable class accents and verified local auth/port
operations without changing business contracts.
V14 adds historical lesson/name snapshots, effective-dated class/enrollment
activity, versioned recurring schedules, source-linked subset makeup lessons,
atomic temporary rescheduling and shared conflict warnings while preserving
existing tuition and PAID-boundary rules.

## Known limitations

- Generic Excel import remains deferred beyond V1 as a separate controlled
  legacy-migration task.
- Desktop drag/drop calendar is outside V1; the approved mobile week list is complete.
- Production-specific public teacher/contact/domain values must be supplied through
  the validated `PUBLIC_*` deployment variables before a production build.

## V15

Đã triển khai replacement cancellation, entitlement học bù, bulk reschedule,
conflict/lịch bận, thu trước, settlement đợt dở, chuyển lớp và contact Homepage.
