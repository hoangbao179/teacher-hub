# M6B Acceptance

- [x] Authenticated export returns XLSX MIME, attachment disposition and safe
  filename; unauthenticated, unknown student and invalid filters are rejected.
- [x] Optional date/class filters are validated against the selected student and
  use actual lesson date boundaries inclusively.
- [x] Workbook has `Quá trình học tập`, `Học phí` and optional `Tổng hợp` sheets.
- [x] Learning history is chronological, normalized per attendance and includes
  PRESENT, ABSENT and FREE with scheduled/actual time, duration and Vietnamese text.
- [x] Tuition rows contain only stored billable cycle items in stored sequence;
  FREE/ABSENT are excluded, full cycles have eight items and partial cycles are clear.
- [x] Stored price snapshot/payment fields are used without fabricating data.
- [x] Headers freeze, filters work, long text wraps, practical widths and
  `dd/MM/yyyy`/consistent time formatting are applied.
- [x] User text beginning with `=`, `+`, `-` or `@` cannot become a workbook
  formula; no macros, external links, hidden business data or credentials exist.
- [x] Money is numeric integer VND with cell formatting; duration never implies
  additional tuition sessions.
- [x] Export writes one `STUDENT_REPORT_EXPORTED` audit with actor, student,
  filters and timestamp; workbook bytes are not stored.
- [x] Student detail exposes a clear `Xuất báo cáo Excel` authenticated action.
- [x] Unit tests cover ordering, labels, tuition exclusions/sequence, snapshot,
  injection protection and filename.
- [x] Integration tests cover auth/data/filter/sheets/rows/eight-item/partial/time/audit.
- [x] Browser E2E downloads and parses the workbook.
- [x] Shared contracts, OpenAPI, feature/privacy/user documentation are current
  and explicitly defer generic legacy import to a separate migration process.
- [x] `npm run check:fast`, `npm run test:integration` and `npm run test:e2e` pass.
