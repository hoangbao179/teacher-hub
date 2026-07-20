# M4B acceptance

- [x] Four tabs map to `ACCUMULATING`, `PAYMENT_DUE`, `PAID`, `INCOMPLETE`.
- [x] List supports search, class filter, sorting and incremental/paged loading.
- [x] Due tab requests oldest-due ordering and cards show required identity,
  progress, snapshot, status and date information.
- [x] List has loading, empty, error/retry and mutation-success states.
- [x] Detail shows cycle metadata and exact stored item order with scheduled and
  actual time, actual duration and lesson type.
- [x] Detail never renders absent/free attendance as a cycle item.
- [x] Payment route defaults exact snapshot amount and current payment date,
  supports cash/bank transfer and optional note.
- [x] Confirmation is required; submission is disabled while pending and
  duplicate activation cannot create duplicate payment.
- [x] Successful payment refreshes server data and PAID detail is read-only.
- [x] Next accumulating cycle remains unchanged after payment.
- [x] Critical flow passes at 390×844 and the page has no horizontal overflow at 360px.
- [x] `npm run check:fast` passes.
- [x] `npm run test:e2e` passes.
