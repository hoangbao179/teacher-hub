# M5A — Schedule projection and reconciliation backend

## Goal

Implement deterministic projected occurrences, one-occurrence exceptions,
canonical draft creation, busy slots and conflict warnings without duplicating
lesson completion or tuition logic.

## Scope

- Date-range/class/state occurrence query with documented lookback and no duplicates.
- Deterministic occurrence key based on recurring schedule ID and occurrence date.
- Create canonical lesson draft, skip and reschedule one occurrence.
- Per-item-result bulk draft and bulk skip commands; never bulk-complete lessons.
- One-time/weekly teacher busy-slot CRUD and overlap warnings.
- Shared contracts, forward-only schema migration, OpenAPI/docs and tests.

## Decisions

- A `CANCELLED` linked lesson handles its source occurrence and is returned as
  `RECORDED` with `linkedLessonStatus=CANCELLED`; it is not unrecorded again.
- A reschedule returns the original as `RESCHEDULED` and a replacement projection
  sourced from the same exception. The recurring schedule definition is unchanged.
- Bulk operations return explicit independent per-item results so one conflict
  does not roll back successful items.
- Conflict detection warns by default. Historical entry and explicit override
  remain possible; no event is automatically moved or deleted.

## Required verification

```bash
npm run check:fast
npm run test:integration
```
