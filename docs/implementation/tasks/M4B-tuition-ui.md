# M4B — Tuition management mobile UI

## Goal

Deliver functional mobile-first tuition list, cycle detail and mark-paid flows
using the M4A APIs.

## Scope

- `/admin/tuition`: four status tabs, search, class filter, sort, pagination,
  retry/loading/empty states and mobile cards.
- `/admin/tuition/:cycleId`: read-only cycle metadata and exact stored item list.
- `/admin/tuition/:cycleId/mark-paid`: full-payment form with confirmation,
  request disabling, success/error feedback and data refresh.
- Distinct Vietnamese status labels and safe React Router navigation.
- Playwright coverage at 390×844 and horizontal-overflow assertion at 360px.

## Business boundaries

- Amount must equal the stored package snapshot; partial payment is unavailable.
- Only `PAYMENT_DUE` exposes payment actions; `PAID` is read-only.
- Duplicate submission must not create a second payment or affect the next cycle.
- Actual duration is informational and never changes item count.

## Required verification

```bash
npm run check:fast
npm run test:e2e
```
