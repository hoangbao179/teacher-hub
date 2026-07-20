# M4A — Tuition query and payment-management backend

## Goal

Expose authenticated tuition-cycle list, summary, detail and full-payment APIs
over the authoritative M2/M3 chronological allocation engine.

## Scope

- Paginated tuition-cycle list with status, class, student/enrollment, name,
  date-range and sort filters.
- Tuition summary aggregated in SQL.
- Cycle detail with stable stored item ordering and lesson/attendance metadata.
- Transactional, audited and idempotent `mark-paid` command.
- Enrollment ending converts only its partial mutable cycle to `INCOMPLETE` by
  invoking the canonical recalculation path.
- Shared contracts, OpenAPI, feature/data-model/audit documentation and tests.

## Business boundaries

- Do not alter chronological allocation, effective-dated price resolution or
  the immutable `PAID` boundary established by M2/M3.
- Only `PAYMENT_DUE` with exactly eight stored items may be paid.
- The paid amount must equal `package_price_snapshot`; V1 has no partial payment.
- A new enrollment after a student resumes owns independent cycle numbering and
  never reopens an `INCOMPLETE` cycle from an ended enrollment.
- `PAYMENT_DUE` and `PAID` cycles remain unchanged when an enrollment ends.

## Required verification

```bash
npm run check:fast
npm run test:integration
```

The checkpoint must also pass route/OpenAPI, database and documentation
consistency checks before status is updated.
