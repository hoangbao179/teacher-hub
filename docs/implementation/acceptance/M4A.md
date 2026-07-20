# M4A acceptance

- [x] List is paginated and filters by supported status, class, student,
  enrollment, student-name search and useful date range without N+1 queries.
- [x] Oldest-due, newest and student-name sorts are deterministic.
- [x] List cards receive cycle/enrollment/student/class identity, progress,
  target, price snapshot, start/eighth/paid dates and next-cycle progress.
- [x] Detail returns stored sequence order and scheduled/actual time, duration,
  lesson type and attendance status for only cycle items.
- [x] Summary aggregates due count/amount, accumulating enrollment count and
  paid count for a selected period in SQL.
- [x] Only a `PAYMENT_DUE` cycle containing exactly eight items can become
  `PAID`, and the amount must exactly match its stored price snapshot.
- [x] Identical payment replay is idempotent; conflicting replay returns HTTP
  409; concurrent requests create one payment outcome.
- [x] Payment and `TUITION_CYCLE_MARKED_PAID` audit record commit atomically.
- [x] Invalid payment rolls back and the next accumulating cycle is unchanged.
- [x] Ending an enrollment at partial progress yields `INCOMPLETE`; existing
  `PAYMENT_DUE` and `PAID` rows remain unchanged.
- [x] Shared contracts, implementation, OpenAPI and feature/data docs agree.
- [x] Unit tests and native-MySQL integration tests cover all P0 rules.
- [x] `npm run check:fast` passes.
- [x] `npm run test:integration` passes.
