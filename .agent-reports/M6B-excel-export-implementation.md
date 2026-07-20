# M6B-excel-export Implementation Report

## Initial repository state

- Branch `dev` at M6A checkpoint commit `fdbb334`, ahead of `origin/dev` by one.
- M6A verification report ends in PASS.
- Only the three user-declared personal legacy workbooks are untracked and ignored.
- Node.js `v24.18.0`, npm `12.0.1`; native MySQL test database is available.
- M6A gates passed: `check:fast`, five-suite `test:e2e`, and root `build`.

## Scope completed

- Added authenticated per-student XLSX export with optional inclusive date and
  historical-class filters.
- Generated canonical learning, tuition and summary sheets from server-authoritative
  data without changing tuition allocation or payment state.
- Added a mobile student-detail download action, audit trail and browser download test.

## Files changed

- Shared: report query contract and package export.
- Server: report domain builder, repository, service, controller, route/container
  wiring, audit action and unit/integration tests.
- Client: binary API helper, student download API, detail-page action and E2E coverage.
- Documentation: OpenAPI, product specifications, feature/privacy/user guidance,
  task, acceptance and checkpoint reports.
- Dependencies: exact `exceljs@4.4.0` runtime dependency for the server and
  development dependency for browser-side workbook assertions.

## Migrations added

None.

## Contracts changed

- Added `StudentReportExportQuery` with optional `fromDate`, `toDate` and `classId`.
- Added `STUDENT_REPORT_EXPORTED` to the audit action contract.

## APIs changed

- Added protected `GET /api/students/{studentId}/export.xlsx`.
- The response uses the XLSX MIME type, attachment disposition, private/no-store
  caching and a sanitized ASCII/RFC 5987 filename.

## Business rules affected

- Reporting is read-only except for one export audit event.
- Learning history follows actual lesson date and normalized attendance.
- Tuition rows come only from stored cycle items, preserve stored sequence and
  price/payment snapshots, and never convert duration into sessions.
- PAID locks, chronological allocation and full-payment rules remain unchanged.

## UI flows implemented

- Added `Xuất báo cáo Excel` to student detail with disabled/busy state, success
  confirmation, error feedback and browser-native download.

## Security and performance changes

- Neutralized formula-like user text, sanitized filenames and emitted no formulas,
  macros, links, hidden data, credentials or temporary server files.
- Limited each data set to 5,000 rows before in-memory generation.
- Kept VND values as formatted integer numbers and applied frozen headers, filters,
  wrapping and practical column widths.

## Tests added

- Domain unit tests cover filename/text safety, chronology, Vietnamese labels,
  cycle sequence/exclusions, snapshot values and workbook formatting.
- Native-MySQL integration tests cover authorization, filters, canonical rows,
  full/partial cycles, response headers and audit creation.
- Tuition browser E2E downloads the real attachment and parses all three sheets.

## Commands executed

- `npm install -w server exceljs@4.4.0 --save-exact`
- `npm install -w client exceljs@4.4.0 --save-dev --save-exact`
- `npm run check:fast`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run check:repo`
- `npm audit --omit=dev --json`
- UTF-8 scan and `git diff --check`
- Read-only Microsoft Excel COM open of the downloaded workbook.

## Results

- Fast gate passed: 36 unit tests plus shared/server/client typecheck, lint and builds.
- Integration gate passed: 20 tests against native MySQL.
- E2E gate passed: all five suites, including workbook download and parse.
- Express/OpenAPI consistency passed with 52 route pairs.
- Root production build passed without a Vite chunk warning.
- UTF-8 and whitespace checks passed.

## Manual browser verification

- Playwright downloaded and parsed the generated XLSX from student detail.
- Microsoft Excel opened the same workbook read-only and reported `Quá trình học tập`,
  `Học phí` and `Tổng hợp` without a repair warning.

## Known gaps

Generic legacy Excel import is explicitly outside V1 and remains deferred.
The production dependency audit reports one moderate advisory inherited through
ExcelJS's UUID dependency. The affected buffer-accepting UUID code path is not used
by this export; it is recorded for the M6D release audit and dependency follow-up.

## Documentation updated

- `docs/implementation/tasks/M6B-excel-export.md`
- `docs/implementation/acceptance/M6B.md`
- `docs/api/openapi.yaml`
- `docs/product-spec/07-domain-model-data-dictionary.md`
- `docs/product-spec/08-logical-api-contract.md`
- `docs/product-spec/11-excel-export-specification.md`
- `docs/features/excel-reports.md`
- `docs/security/data-exposure.md`
- `docs/user-guide/teacher-guide.md`
- `docs/reference/legacy-excel/README.md`

## Git status

All M6B files are prepared for the checkpoint commit. The three user-declared
personal workbook files remain untracked, preserved and excluded.
