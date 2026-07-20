# M5B acceptance

- [x] Dashboard shows real PAYMENT_DUE count/amount, unrecorded count and today events.
- [x] Dashboard links open tuition/reconciliation and working lesson, makeup and busy actions.
- [x] Reconciliation filters date range, class and state with loading/empty/error states.
- [x] “Đã dạy” creates one canonical draft and navigates to the M2 lesson wizard.
- [x] Skip requires confirmation/reason; reschedule collects replacement date/time and shows warnings.
- [x] Multi-select bulk create-draft and bulk-skip expose per-item results and never complete lessons.
- [x] Weekly mobile calendar shows projections, draft/completed/makeup/rescheduled/skipped and busy events.
- [x] Calendar supports previous/next week, date selection and working event links/actions.
- [x] Busy-slot UI creates/edits one-time and weekly slots and exposes conflict warnings.
- [x] Makeup entry points from dashboard, class detail and calendar reuse the existing wizard.
- [x] All new screens use real APIs and provide loading, empty, retry, confirmation, success and disabled states.
- [x] Critical Playwright flow covers dashboard, reconciliation, canonical completion, skip/reschedule/bulk and calendar/busy/makeup.
- [x] Browser verification passes at 390×844 with no page horizontal overflow at 360 px.
- [x] Shared contracts, OpenAPI and feature/UI docs agree.
- [x] `npm run check:fast` passes.
- [x] `npm run test:e2e` passes.
- [x] `npm run check:full` passes.
