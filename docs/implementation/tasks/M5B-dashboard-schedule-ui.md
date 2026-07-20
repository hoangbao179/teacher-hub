# M5B — Dashboard and schedule operations mobile UI

## Goal

Deliver the teacher's daily mobile operations over the M4A/M5A APIs: real
dashboard summaries, occurrence reconciliation, weekly calendar, busy-slot
management and makeup entry points that reuse the canonical lesson wizard.

## Scope

- Real tuition/unrecorded/today dashboard cards and quick actions.
- Reconciliation date/class/state filters, per-occurrence actions and bulk draft/skip.
- Mobile weekly calendar with projections, lessons, exceptions and busy slots.
- One-time/weekly busy-slot create/edit form with conflict warnings.
- Makeup links from dashboard, class detail and calendar into the M2 wizard.
- Loading, empty, retry, confirmation, success and disabled request states.
- Shared/API adjustments only where required to supply the UI; no duplicate lesson
  completion or tuition allocation logic.
- Playwright coverage at 390×844 and horizontal-overflow coverage at 360 px.

## Decisions

- The dashboard composes efficient tuition summary and schedule occurrence/week
  APIs; it never calculates or increments tuition in the browser.
- “Đã dạy” creates a canonical draft then navigates to its returned wizard path.
- Bulk actions keep M5A's explicit per-item semantics and never bulk-complete.
- The mobile calendar is a compact chronological week list, not drag-and-drop.
- Makeup navigation pre-fills the existing lesson creation route with
  `lessonType=MAKEUP`; participant selection remains mandatory in the M2 wizard.

## Required verification

```bash
npm run check:fast
npm run test:e2e
npm run check:full
```

Manual browser verification is required at 390×844 and 360 px before PASS.
