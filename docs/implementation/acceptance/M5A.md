# M5A acceptance

- [x] Projection honors effective boundaries, class status and deterministic keys.
- [x] Query filters date/week, class and state, applies configured lookback and avoids duplicates.
- [x] Draft/completed/cancelled linked lessons all handle an original occurrence;
  cancellation semantics are explicit in contract/docs.
- [x] Create-draft copies original or replacement date/time and invokes the canonical
  M2 participant snapshot; it never creates attendance or tuition effects.
- [x] Identical create-draft/skip/reschedule requests are idempotent.
- [x] Skip stores original schedule/date/time, reason/note/actor and changes no tuition.
- [x] Reschedule handles only one original occurrence, leaves recurrence unchanged,
  exposes replacement projection and returns conflict warnings.
- [x] Busy-slot CRUD supports one-time and weekly recurrence without student/tuition fields.
- [x] Conflict detection covers projected occurrences, lessons (including makeup),
  reschedules and busy slots and returns warnings by default.
- [x] Bulk draft/skip returns explicit per-item results and never completes lessons.
- [x] Unit tests cover projection, boundaries, keys, skip/reschedule, duplicates,
  cancellation and overlap.
- [x] Native-MySQL tests cover all commands, idempotency, canonical snapshot,
  busy conflicts, bulk behavior and absence of tuition mutation.
- [x] Shared contracts, OpenAPI, schema and docs agree.
- [x] `npm run check:fast` passes.
- [x] `npm run test:integration` passes.
