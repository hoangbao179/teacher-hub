# UIC Implementation Report

## Initial repository state

- UIC began only after the UIB verification report ended in PASS.
- Repository commit remained `5294f53`; expected UIA/UIB source and report changes
  were present, with no new migration and three private workbooks reserved for UID.

## Baseline problems

- `CompleteLessonResult.completedAt` was generated with `new Date()` after every
  request, so an idempotent replay returned different metadata.
- The database row already exposed `completed_at`, but the repository mapper omitted it.
- The shared lesson detail/OpenAPI schemas did not expose the stored timestamp.
- An unused lesson placeholder page and obsolete append-only tuition method remained.

## Scope completed

- Mapped stored lesson completion time into every `LessonSummary`/`LessonDetail`.
- Returned that persisted value from both first completion and idempotent replay.
- Added replay equality and parseability assertions while retaining the existing
  no-duplicate-cycle assertion.
- Removed confirmed dead lesson and incremental tuition code.
- Extended deterministic fake-action and stale-code repository checks.

## Files changed

- `shared/src/contracts/lessons.ts`.
- `server/src/repositories/lesson.repository.ts`,
  `server/src/repositories/tuition.repository.ts`, `server/src/services/lesson.service.ts`.
- `server/src/services/m2b.integration.test.ts`, `docs/api/openapi.yaml`.
- Deleted `client/src/pages/LessonCompletePlaceholderPage.tsx`.
- `scripts/check-repo.mjs` and UIC acceptance/status/report files.

## Design-system changes

- None.

## Responsive changes

- None.

## Correctness fixes

- MySQL `DATETIME` completion values are serialized as RFC 3339 values with the
  documented `+07:00` application offset.
- Completion now treats a missing stored timestamp on a completed row as an invariant
  failure instead of fabricating metadata.
- OpenAPI marks nullable `LessonDetail.completedAt` and required non-null completion
  response `completedAt`, including all existing result metadata in its required list.

## Cleanup performed

- Removed `LessonCompletePlaceholderPage`, which had no import or route.
- Removed `TuitionRepository.addBillableAttendance`, which had no caller and conflicted
  conceptually with the M3 chronological recalculation source of truth.
- Reviewed 508-line lesson service, 410-line tuition repository, 494-line schedule
  repository and 369-line wizard. They remain cohesive around transaction/lock context
  or multi-step form state; cosmetic splitting would increase indirection and risk.
- Audited client loaders/actions. The centralized API layer already normalizes network
  errors and 401 handling; bounded page loaders and existing active guards did not justify
  a new query framework or broad request rewrite.

## Packaging/security changes

- None; UID scope.

## Tests added

- Integration assertions that first completion, stored lesson detail and replay share
  exactly one `completedAt`; the value also parses as a timestamp.
- Repository checker self-probes and scans for empty handlers, `href="#"`, TODO-only
  handlers, obsolete lesson placeholder and `addBillableAttendance` reintroduction.

## Commands executed

- Targeted `rg` audits for completion metadata, dead files/methods, routes, exports,
  request loaders and enabled controls.
- `npm run typecheck`
- `npm run check:repo`
- `npm run test:integration`
- `npm run check:fast`
- `npm run test:e2e`
- `npm run build`

## Results

- Repository consistency: PASS; 52 source routes match OpenAPI.
- Integration: PASS, 20/20 including persisted completion replay and no duplicate cycle.
- `check:fast`: PASS; typecheck, lint, 36 unit tests and build.
- Full E2E: PASS; all five suites in 74.2 seconds.
- Final explicit build: PASS.

## Manual mobile review

- No visual behavior changed in UIC. E2E re-exercised the mobile lesson, tuition,
  schedule, CRUD, authentication and Homepage flows at their established viewports.

## Manual desktop review

- No visual behavior changed in UIC; UIB desktop evidence remains current.

## Known gaps

- Large files were deliberately retained for transaction/lock and wizard-state cohesion.
- A future API version could standardize every database timestamp through one shared
  serializer, but UIC changed only the confirmed completion inconsistency.

## Documentation updated

- Shared contract and OpenAPI completion schemas are synchronized.
- UIC acceptance, implementation, verification and status evidence are recorded.

## Git status

- UIC changes are present alongside the expected UIA/UIB work.
- No migration was added or edited; private workbooks remain untouched until UID.
