# M3-chronological-recalculation Implementation Report

## Initial repository state

- M2A, M2B and M2C verification verdicts: `PASS`; no checkpoint commit was created.
- `teacher_hub_test` has migrations through `0004_m2a_lesson_domain.sql`.
- M2B allocation is deliberately incremental and completed edits are still locked.
- Preserved pre-existing `AGENTS.md` and Excel files remain outside task ownership.

## Scope completed

- Replaced incremental allocation with deterministic rebuild for every affected enrollment.
- Added safe completed date/time/attendance/participant corrections and immutable PAID boundary.
- Added manual-exclusion storage and exact MySQL DATE handling.

## Files changed

- Recalculation domain/repository/service/tests, migration, completed-edit UI,
  Playwright M3 extension, OpenAPI and architecture/feature/data-model/ADR docs.

## Migrations added

- `server/src/db/migrations/0005_m3_recalculation.sql` adds
  `lesson_attendances.excluded_from_tuition`, recalculation index and consistency check.

## Contracts changed

- Completed participant update accepts full `attendances` for explicit snapshot correction.

## APIs changed

- Existing PATCH/participant/attendance/content endpoints now support approved completed edits.
- Any paid-boundary effect returns typed HTTP 409 `PAID_CYCLE_CONFLICT`.

## Business rules implemented

- Billable means COMPLETED + PRESENT + effective non-FREE + not manually excluded.
- Sort key: lesson date, actual start fallback, scheduled start, lesson ID, attendance ID.
- Mutable groups are exactly 8 `PAYMENT_DUE` plus optional partial `ACCUMULATING`.
- Price snapshot comes from policy effective on the group's first attendance date.
- PAID cycles/items are untouched; crossing or editing them rolls back.

## UI flows implemented

- Completed wizard can save approved information/content/attendance corrections and shows paid conflict.
- Playwright creates out-of-order technical lessons, verifies 8/8 + 2/8 and exercises conflict UI.

## Tests added

- Four M3 unit tests and two native-MySQL suites covering out-of-order 10 lessons,
  earlier insertion, PRESENT↔ABSENT, manual exclusion, participant correction,
  idempotence, historical price, duplicate prevention and PAID rollback.
- Playwright chronological allocation/detail and paid-conflict UI coverage.

## Commands executed

- Read M3 task/acceptance, inspected git status and migrations.
- `npm run typecheck`; `npm run test`
- `npm run check:fast`
- `npm run test:integration` (multiple passing reruns)
- `npm run test:e2e` (one DATE diagnostic failure, then passing reruns)
- `npm run check:full`
- `git diff --check`; UTF-8 scan; `git status`; staged/unstaged diff stats

## Results

- `check:fast`: PASS — 23 unit tests, typecheck/lint/build pass.
- Native MySQL integration: PASS — 11/11.
- E2E: PASS — M1 smoke + M2C mobile + M3 chronological/conflict flows.
- `check:full`: PASS; repository consistency 39/39 routes.

## Manual browser verification

PASS — Playwright used a real 390×844 Chrome page for login, regular and makeup
lessons, historical entry, chronological progress and paid-conflict feedback.
The agent visually inspected the mobile confirmation screenshot; 360px overflow
measurement and refresh persistence also passed.

## Known gaps

- No blocker within M2/M3. Paid unlock/payment UI remains intentionally out of scope (M4).
- Existing Vite chunk-size warning is non-failing.

## Documentation updated

- Late-entry ADR, OpenAPI, database/frontend architecture, lesson/tuition features,
  data dictionary, status and roadmap are synchronized.

## Git status

All M2A–M3 changes are uncommitted. The index contains a mix of staged/unstaged
task changes and also shows the pre-existing `AGENTS.md`/Excel files; no commit was created.
