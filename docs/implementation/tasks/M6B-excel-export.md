# M6B — Per-student Excel export

## Goal

Generate one authenticated, canonical parent-facing XLSX workbook for a selected
student from server-authoritative MySQL data.

## Scope

- `GET /api/students/{studentId}/export.xlsx` with optional `fromDate`, `toDate`
  and historical `classId` filters.
- Validate authentication, IDs, date range and the student's class relationship.
- Return a bounded in-memory XLSX attachment with safe cross-platform filename,
  correct MIME type and no temporary file.
- Required sheets `Quá trình học tập` and `Học phí`, plus bounded `Tổng hợp`.
- Chronological normalized learning rows including PRESENT, ABSENT and FREE.
- Tuition rows from stored cycle items only, using item sequence and price snapshot.
- Formula-injection protection, numeric integer money, wrapped text, filters,
  frozen headers and practical widths.
- Transactional-independent audit event `STUDENT_REPORT_EXPORTED` after workbook
  data is authorized and generated; workbook bytes are never persisted.
- Student-detail authenticated download action and parseable-browser-download E2E.
- OpenAPI, shared contract, privacy/export docs and user guide updates.

## Exclusions

- Generic Excel import, arbitrary legacy workbook parsing, temp-file persistence,
  payment fabrication, partial payment and any change to tuition allocation.

## Required verification

```bash
npm run check:fast
npm run test:integration
npm run test:e2e
```

M6C must not begin until the M6B verification report ends in `PASS`.
