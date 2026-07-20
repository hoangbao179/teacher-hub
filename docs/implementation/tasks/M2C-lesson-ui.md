# M2C — Mobile lesson-recording wizard

## Goal

Implement the four-step, server-persisted lesson wizard at mobile widths.

## Scope

- Routes `/admin/lessons/new` and `/admin/lessons/:id/edit`.
- Information, attendance, content/homework and confirmation steps.
- REGULAR/MAKEUP participant UX, default attendance and completion result.
- Loading, empty, validation, error/conflict and unsaved-change states.
- Sticky mobile actions and Playwright browser coverage around 390×844.

## Out of scope

Tuition-management screens, payment, schedule exception UI and dashboard redesign.

## Required verification

`npm run check:fast` and `npm run test:e2e`, including inspected mobile output.
