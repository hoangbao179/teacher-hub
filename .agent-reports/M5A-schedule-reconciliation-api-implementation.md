# M5A-schedule-reconciliation-api Implementation Report

## Initial repository state

- Branch `dev`, HEAD `cee6104` (`feat(tuition): complete M4B mobile management`).
- M4A and M4B verification verdicts are `PASS`, each with a committed checkpoint.
- Only three user-approved legacy Excel workbooks are untracked.
- Native MySQL has migrations through `0005`.
- Existing schedule API only expands a simple unrecorded list and week scaffold;
  it has no deterministic schedule ID key, commands, busy CRUD or conflict model.

## Scope completed

- Added deterministic recurring occurrence projection with effective-date, active
  class, date-range, class/state and bounded-lookback behavior.
- Added canonical create-draft, single-occurrence skip/reschedule, per-item bulk
  operations, teacher busy-slot CRUD and non-blocking conflict warnings.
- Preserved the M2/M3 lesson completion and chronological tuition engine unchanged.

## Files changed

- Shared schedule contracts.
- Schedule projection domain, repository, service, controller, routes and container.
- Lesson repository/service support for idempotent source-occurrence draft creation.
- Audit action/entity unions and forward-only migration `0006`.
- Unit/native-MySQL tests, OpenAPI, scheduling/database/data-model/API docs and
  checkpoint task/acceptance/reports/status.

## Migrations added

`0006_m5a_schedule_operations.sql`:

- links schedule exceptions to recurring schedules and snapshots original time;
- adds exception note/actor and one-exception-per-schedule/date uniqueness;
- adds nullable unique `lesson_sessions.source_occurrence_key`;
- adds busy-slot actor attribution;
- explicitly backfills compatible legacy exception rows without resetting data.

## Contracts changed

- Added occurrence state/source, deterministic keys, linked lesson/exception data,
  conflict warnings, command results, bulk per-item results and busy-slot DTOs.
- Expanded compatibility unrecorded/week responses with schedule identifiers and
  reconciled occurrences.

## APIs changed

- Added `GET /api/schedule/occurrences`.
- Added create-draft, skip and reschedule commands under
  `/api/schedule/occurrences/{key}`.
- Added bulk-create-drafts and bulk-skip commands.
- Added `GET/POST /api/teacher-busy-slots` and
  `PATCH/DELETE /api/teacher-busy-slots/{id}`.
- Retained `/api/schedule/unrecorded` and `/api/schedule/week` as compatible views.

## Business rules implemented

- Recurring projections never count as teaching and never mutate tuition.
- `DRAFT`, `COMPLETED` and `CANCELLED` lessons all handle their source occurrence;
  cancellation is exposed through `linkedLessonStatus` rather than silently reopened.
- A reschedule handles only the original occurrence and projects a `:R` replacement;
  it never edits recurrence.
- Create-draft copies occurrence date/time and calls the canonical participant
  snapshot transaction. Concurrent/replayed requests resolve to one lesson.
- Conflict warnings include projections, regular/makeup/rescheduled lessons and
  one-time/weekly busy slots; warnings do not alter or silently block other events.
- Busy slots and bulk operations create no attendance or tuition effects.

## UI flows implemented

None; M5A is backend-only.

## Tests added

- Six schedule projection unit cases covering boundaries, de-duplication, valid and
  impossible keys, skip/reschedule/replacement, cancellation and half-open overlap.
- Three native-MySQL suites covering active-class projection/filters, concurrent
  draft idempotency and canonical snapshot, cancel/skip/reschedule replay,
  projection/makeup/busy conflicts, busy CRUD, bulk behavior and zero tuition mutation.

## Commands executed

- Read all required source-of-truth documents, contracts, migrations and M2/M3 code.
- `npm run test`
- `npm run test:integration`
- `npm run typecheck`
- `npm run check:repo`
- `npm run check:fast`
- Native MySQL information-schema inspection for migration `0006`.
- `git diff --check`
- UTF-8 mojibake scan.

## Results

- `check:fast`: PASS; 34 unit tests passed, 17 integration tests correctly skipped
  in the unit runner, typecheck/lint/build all passed.
- Native MySQL integration: PASS, 17/17.
- Repository consistency: PASS, all 50 Express method/path pairs match OpenAPI.
- Migration `0006` is recorded and required columns/unique indexes exist in
  `teacher_hub_test` on MySQL 8.
- Vite's existing non-failing chunk-size warning remains.

## Manual browser verification

Not applicable to backend-only M5A.

## Known gaps

- M5A is backend-only; dashboard/reconciliation/calendar/busy-slot UI is M5B.
- A cancelled linked lesson remains an explicit handled occurrence by design; a
  future reopen flow would require its own approved command.

## Documentation updated

OpenAPI, scheduling feature, database architecture, data dictionary, logical API,
task/acceptance, status and roadmap.

## Git status

M5A changes are ready for the checkpoint commit. The three user-approved legacy
Excel files remain untracked, ignored for task cleanliness and untouched.
