# M2A-lesson-domain Implementation Report

## Initial repository state

- Branch `dev`, tracking `origin/dev`; HEAD `02ef9b6`.
- Pre-existing tracked change: `AGENTS.md` (task lifecycle/checkpoint instructions).
- Pre-existing untracked user data: three workbooks under `docs/reference/legacy-excel/`.
- Node `v24.18.0`, npm `12.0.1`; M1.1 source/report status is `PASS`.
- Native MySQL `teacher_hub_test` is available; baseline integration tests passed 3/3.
- Applied baseline migrations: `0001`, `0002`, `0003`.

## Scope completed

- Added participant snapshot and effective-dated class/enrollment tuition domains.
- Added historical resolution, backfills, DB integrity and shared M2 contracts.
- Integrated policy history into class/enrollment create and price/mode changes.

## Files changed

- Migration/domain/repositories/tests/contracts and relevant architecture/feature/data-model docs.
- Four task documents and four acceptance documents were created for the full task group.

## Migrations added

- `server/src/db/migrations/0004_m2a_lesson_domain.sql`.
- Adds/backfills `class_tuition_policies`, `enrollment_tuition_policies` and
  `lesson_session_participants`; links attendance to participant identity and adds cycle checks.

## Contracts changed

- Added update/draft/detail/participant/attendance/content/cancel DTOs, lesson
  participant details, progress impact, completion summary and typed domain error codes.

## APIs changed

None in M2A.

## Business rules implemented

- Eligibility is `joined_at <= session_date` and inclusive `ended_at`.
- Regular snapshot means all eligible enrollments; selected snapshot supports MAKEUP.
- `CLASS_DEFAULT` resolves class policy history; `CUSTOM` owns a positive price; `FREE` has none.
- Policy replacement splits inclusive ranges transactionally without overlap.
- Attendance outside the participant composite identity is rejected by MySQL.
- Cycle target is exactly 8, price is positive and item sequence is 1..8.

## UI flows implemented

None in M2A.

## Tests added

- Four pure domain tests and three native-MySQL M2A integration cases.

## Commands executed

- `node --version`; `npm --version`
- `git status --short`; `git log -5 --oneline`
- `npm run test:integration` (baseline)
- Read-only `information_schema` inspection of `teacher_hub_test`
- `npm run typecheck`
- `npm run check:fast`
- `npm run test:integration` (one diagnostic failure, then passing rerun)
- `git diff --check`
- UTF-8 mojibake scan

## Results

- `check:fast`: PASS; 14 unit tests passed, 6 integration tests correctly skipped there.
- Native MySQL integration: PASS, 6/6 on final run.
- Build/typecheck/lint: PASS. Vite retained its pre-existing non-failing chunk warning.

## Manual browser verification

Not applicable to M2A.

## Known gaps

- No M2A blocker. Lesson endpoints/wizard/recalculation intentionally remain for M2B/M2C/M3.

## Documentation updated

ADR effective-date design, database architecture, lesson/tuition feature docs and
domain data dictionary updated.

## Git status

Working tree contains the documented pre-existing `AGENTS.md`/Excel files and the
uncommitted M2A changes. No commit was created.
