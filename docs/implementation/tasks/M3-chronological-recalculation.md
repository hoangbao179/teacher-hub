# M3 — Chronological tuition recalculation

## Goal

Rebuild mutable tuition cycles from completed billable attendance in historical,
deterministic order while preserving every `PAID` cycle and item.

## Scope

- Deterministic ordering by lesson date/time and stable identifiers.
- Groups of eight into `PAYMENT_DUE`, plus a final partial `ACCUMULATING` cycle.
- Effective-date price snapshot from each cycle's first attendance.
- Safe completed-lesson attendance/date/time/participant corrections.
- Typed `PAID_CYCLE_CONFLICT`, transaction rollback and audit trail.
- Unit, native-MySQL integration and browser conflict/reordering coverage.

## Out of scope

Unlocking paid cycles, payment/tuition-management UI and M4–M6 features.

## Required verification

`npm run check:fast`, `npm run test:integration`, `npm run test:e2e` and
`npm run check:full`.
