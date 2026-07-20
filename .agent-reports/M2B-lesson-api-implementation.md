# M2B-lesson-api Implementation Report

## Initial repository state

- M2A verification verdict: `PASS`; no commit was created between checkpoints.
- M2A migration `0004_m2a_lesson_domain.sql` is applied on `teacher_hub_test`.
- Pre-existing `AGENTS.md` modification and three untracked Excel workbooks remain preserved.
- M2B starts from the pre-M2 two-endpoint lesson scaffold documented in the M2A report.

## Scope completed

- Replaced the scaffold with canonical draft/detail/update/participant/attendance/content/complete/cancel services.
- Completion is row-locked, atomic, audited and safe for duplicate/concurrent requests.
- Participant and effective-policy domains from M2A are authoritative.

## Files changed

- Lesson controller/service/repository, tuition/audit repositories, routes,
  shared contracts, OpenAPI, repository checker and M2B unit/integration tests.

## Migrations added

None planned for M2B.

## Contracts changed

- Added optional `classId` to draft patch; the remainder of required lesson DTOs
  were established in M2A and are now implemented by both HTTP and service layers.

## APIs changed

- `POST /api/lessons`
- `GET/PATCH /api/lessons/:id`
- `PUT /api/lessons/:id/participants`
- `PUT /api/lessons/:id/attendances`
- `PUT /api/lessons/:id/content`
- `POST /api/lessons/:id/complete`
- `POST /api/lessons/:id/cancel`

## Business rules implemented

- REGULAR uses all historical eligible enrollments; MAKEUP and EXTRA require selected IDs.
- Draft basis changes require explicit participant refresh.
- Exactly one final attendance per participant; global FREE rejects PRESENT billing.
- Actual duration is validated/stored but never changes the one-session count.
- Completion allocates from the policy effective on the lesson date and audits all effects.
- Completed replay/concurrent completion returns persisted state without duplicate rows.

## UI flows implemented

None in M2B.

## Tests added

- Five M2B domain unit tests and three MySQL workflow cases covering regular,
  makeup, persistence, rollback, free policy, cancel, replay and concurrency.

## Commands executed

- Read M2B task/acceptance, inspected git status and migrations.
- `npm run typecheck`; `npm run test`
- `npm run check:repo`
- `npm run check:fast`
- `npm run test:integration`
- `git diff --check`; UTF-8 mojibake scan

## Results

- `check:fast`: PASS; 19 unit tests passed, 9 integration cases skipped there.
- Native MySQL integration: PASS, 9/9.
- Repository consistency: PASS, 39/39 Express routes match OpenAPI.

## Manual browser verification

Not applicable to backend checkpoint M2B.

## Known gaps

- Chronological rebuild of historical mutable cycles remains M3 by design.
- Mobile wizard remains M2C.

## Documentation updated

- OpenAPI documents all lesson requests/responses/errors/examples.
- Lesson feature documents canonical API and selected EXTRA behavior.

## Git status

M2A + M2B changes are uncommitted. Preserved user `AGENTS.md` and Excel files remain.
