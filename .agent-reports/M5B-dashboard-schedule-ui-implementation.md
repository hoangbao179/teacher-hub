# M5B-dashboard-schedule-ui Implementation Report

## Initial repository state

- Branch `dev`, HEAD `02db2c9` (`feat(schedule): complete M5A reconciliation backend`).
- M4A, M4B and M5A verification verdicts are `PASS`, each with a committed checkpoint.
- Only three user-approved legacy Excel workbooks are untracked and remain outside task ownership.
- Native MySQL has migrations through `0006`.
- Existing dashboard/reconciliation/calendar pages are scaffold views and do not yet
  expose the complete M5 operational flows.

## Scope completed

- Replaced scaffold Dashboard, unrecorded and calendar views with complete mobile
  daily-operations flows over real M4A/M5A APIs.
- Added reconciliation actions/bulk selection, weekly event timeline and one-time/
  weekly busy-slot create/edit/delete UI with conflict warnings.
- Added dashboard schedule aggregation without class-detail N+1 queries and exposed
  standalone makeup lessons plus expanded busy occurrences to the calendar.
- Preserved canonical lesson wizard and tuition allocation/payment boundaries.

## Files changed

- Dashboard/week shared contracts and schedule API client.
- Dashboard/schedule backend service, repository, controller, routes and container.
- Dashboard, reconciliation, calendar, busy-slot form, loading cards and date utility.
- Lesson wizard query prefill and admin routes; removed obsolete scaffold page.
- Playwright M5B operations suite and client test command.
- OpenAPI, frontend/scheduling/daily-operations docs and checkpoint docs/reports/status.

## Migrations added

None. M5A migration `0006` already supports all M5B persistence.

## Contracts changed

- Dashboard now returns `totalUnpaidAmount`, authoritative `unrecordedCount` and a
  reconciled `todaySchedule` instead of requiring client-side class derivation.
- Week schedule now returns required occurrence data, standalone lesson events and
  busy-slot occurrences expanded to exact dates.

## APIs changed

- Enriched `GET /api/dashboard` and `GET /api/schedule/week` response contracts.
- Added `GET /api/teacher-busy-slots/{id}` for reload-safe edit forms.
- Existing M5A occurrence/bulk/mutation APIs are consumed through
  `client/src/api/schedule.ts` without direct page `fetch` calls.

## Business rules implemented

- Dashboard cards use SQL tuition summary and server schedule projections; no
  hard-coded counts or browser tuition calculations.
- Reconciliation only creates drafts/exceptions and never attendance/tuition.
- “Đã dạy” follows the server-returned canonical M2 wizard path; the tested wizard
  completion is the only operation that changes attendance/tuition.
- Reschedule remains one occurrence and warnings are non-blocking; bulk drafts stay
  independent and are never bulk-completed.
- Busy slots expose no student/attendance/tuition fields.

## UI flows implemented

- `/admin`: tuition/unrecorded/today cards, today timeline and three quick actions.
- `/admin/reconciliation`: date/class/state filters, cards, create-draft, confirmed
  skip, reschedule with warnings, select-all and bulk draft/skip dialogs/results.
- `/admin/calendar`: previous/next/date week navigation and chronological cards for
  projections, linked/standalone lessons, makeup, exceptions and busy occurrences.
- `/admin/busy-slots/new` and `/:id/edit`: one-time/weekly fields, effective ranges,
  conflicts, persistence, update and delete.
- Dashboard, class detail and calendar makeup links reuse the M2 wizard with
  `MAKEUP` preselected and optional date prefill.

## Tests added

- `schedule-operations.e2e.mjs` creates real MySQL fixtures and verifies dashboard
  aggregate deltas/links; canonical draft completion; skip; warned reschedule;
  bulk drafts; one-time create and weekly busy edit; makeup entry/persistence;
  calendar statuses/week navigation; persistence and mobile layout.
- Existing browser smoke, lesson/M3 and tuition/M4B suites remain in the combined gate.

## Commands executed

- `npm run typecheck`
- `npm -w client run lint`
- focused `node client/scripts/schedule-operations.e2e.mjs`
- `npm run check:repo`
- `npm run check:fast`
- `npm run test:e2e`
- `npm run check:full`
- `git diff --check`
- UTF-8 mojibake scan.

## Results

- `check:fast`: PASS; 34 unit tests passed and 17 integration cases correctly
  skipped in the unit runner; typecheck/lint/build passed.
- `test:e2e`: PASS — browser smoke, lesson/M3, tuition/M4B and M5B operations.
- The final combined browser audit also verifies Dashboard due count and unpaid
  amount decrease after a full payment.
- `check:full`: PASS — 34 unit, 17/17 native-MySQL integration, all browser suites,
  build/lint/typecheck and repository consistency.
- OpenAPI consistency: PASS, all 51 Express method/path pairs match.
- Existing non-failing Vite chunk-size warning remains.

## Manual browser verification

- Visually inspected the full-run 390×844 calendar screenshot at
  `C:\Users\HOANGBAO\AppData\Local\Temp\teacher-hub-m5b-calendar-mobile.png`.
- Cards, wrapped long names, distinct state colors, quick actions and bottom
  navigation are readable and usable. Automated layout assertion found no page
  horizontal overflow at 360 px.
- Browser flow persisted dashboard, canonical completion, skip/reschedule/bulk,
  busy create/edit, makeup draft and week navigation after reload/navigation.
- Across the four browser suites, the required final flow also opens an eight-item
  cycle, marks it paid, confirms Dashboard aggregates refresh, and creates a
  selected-participant makeup lesson through the canonical wizard.

## Known gaps

- Desktop drag/drop calendar is intentionally out of V1 scope.
- M6 homepage polish and Excel export/import remain explicitly out of this task.
- Production bundle emits the pre-existing non-failing chunk-size warning.

## Documentation updated

OpenAPI, scheduling/daily-operations features, frontend architecture, logical API,
task/acceptance, implementation status and roadmap.

## Git status

M5B changes are ready for the checkpoint commit. The three user-approved legacy
Excel workbooks remain untracked, ignored for task cleanliness and untouched.
