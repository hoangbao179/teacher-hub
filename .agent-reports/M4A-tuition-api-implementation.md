# M4A-tuition-api Implementation Report

## Initial repository state

- Branch `dev`, HEAD `4347dad` (`milestone 2 và 3`), synchronized with `origin/dev`.
- User-approved exception: three untracked legacy Excel workbooks under
  `docs/reference/legacy-excel/`; they remain outside task ownership.
- M2A, M2B, M2C and M3 verification reports are `PASS` and committed in HEAD.
- Node `v24.18.0`, npm `12.0.1`; native MySQL `8.0.44` is reachable.
- `teacher_hub_test` initially had migrations `0001` through `0005` applied.
- Tuition endpoints were scaffold implementations: unpaginated list, detail
  loading every cycle, and non-transactional/non-audited payment.

## Scope completed

- Added validated/paginated tuition queries, SQL aggregate summary and direct detail.
- Added atomic, audited, idempotent full-payment management.
- Integrated enrollment-ending `INCOMPLETE` behavior without changing M3 allocation.

## Files changed

- Shared tuition contracts; tuition controller/service/repository/domain/tests.
- Enrollment ending, Dashboard summary consumption, route and audit action union.
- OpenAPI, tuition/class features, database architecture, data dictionary and M4A docs/reports.

## Migrations added

None. Existing payment fields and `INCOMPLETE` enum support the checkpoint.

## Contracts changed

- Added list query/sort, pagination metadata fields, enrollment/nickname/target/item
  fields, active next-cycle progress, detailed lesson item metadata, payment result
  and tuition-summary request/response contracts.

## APIs changed

- Expanded `GET /api/tuition-cycles` filters/sorts/pagination.
- Added `GET /api/tuition-cycles/summary`.
- Expanded `GET /api/tuition-cycles/:id` response.
- `POST /api/tuition-cycles/:id/mark-paid` now returns a typed HTTP 200 result;
  identical replay returns `idempotent=true` and conflicting replay returns 409.

## Business rules implemented

- Only `PAYMENT_DUE` with eight items and exact snapshot amount can be paid.
- Payment locks cycle/items and commits fields plus `TUITION_CYCLE_MARKED_PAID` atomically.
- A later accumulating cycle is untouched by payment.
- Ending changes only a partial `ACCUMULATING` cycle to `INCOMPLETE`; due/paid rows remain stable.
- A returning ended student requires a new enrollment with independent cycles.

## UI flows implemented

None; M4A is backend-only.

## Tests added

- Five pure payment-decision unit tests.
- Three native-MySQL suites covering list/filter/sort/detail/summary, invalid and
  concurrent payments, audit/idempotency/conflict, paid immutability and enrollment ending.

## Commands executed

- `npm run typecheck`
- `npm run test`
- `npm run test:integration`
- `npm run check:repo`
- `npm run check:fast`
- `git diff --check`
- UTF-8 mojibake scan

## Results

- `check:fast`: PASS; 28 unit tests passed and 14 integration cases correctly skipped there.
- Native MySQL integration: PASS, 14/14.
- Repository consistency: PASS, 40/40 Express routes match OpenAPI.
- Build/typecheck/lint: PASS; existing Vite chunk warning remains non-failing.

## Manual browser verification

Not applicable to backend-only M4A.

## Known gaps

- Tuition UI is intentionally deferred to M4B.
- Paid-cycle unlock remains out of scope.

## Documentation updated

OpenAPI, tuition/class feature docs, database architecture, data dictionary,
task/acceptance documents, implementation status and roadmap.

## Git status

After the M4A checkpoint commit, only the three user-approved legacy Excel
workbooks remain untracked; they are untouched.
