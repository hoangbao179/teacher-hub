# M2C-lesson-ui Implementation Report

## Initial repository state

- M2A and M2B verification verdicts are `PASS`; changes remain uncommitted by instruction.
- Existing lesson UI is a disabled one-screen scaffold plus completion placeholder.
- Existing E2E is a custom Chrome DevTools smoke runner; no Playwright dependency existed.
- Preserved pre-existing `AGENTS.md` and Excel files remain untouched.

## Scope completed

- Replaced disabled UI with a four-step server-persisted lesson wizard.
- Added REGULAR/MAKEUP/EXTRA selection, attendance, content, confirmation and success states.
- Added Playwright browser coverage while retaining the M1 smoke flow.

## Files changed

- Wizard/routes/class actions, lesson API adapter, Playwright runner, client package/lock,
  frontend/lesson docs and M2C tests/reports.

## Migrations added

None planned for M2C.

## Contracts changed

None; M2A/M2B contracts were sufficient.

## APIs changed

No backend change. `client/src/api/lessons.ts` wraps every M2B endpoint used by the page.

## Business rules implemented

- Scheduled/actual time remains separate and duration is explicitly non-billing.
- MAKEUP/EXTRA requires selected participants; paid defaults PRESENT, global FREE defaults FREE.
- Server-side draft persistence is authoritative; completion displays progress impact.

## UI flows implemented

- Four visible steps at new/edit routes with sticky actions, character counters,
  loading/empty/validation/conflict/success states and unsaved-change warning.
- Class detail now links to regular and makeup creation.

## Tests added

- Playwright 1.61.1 test drives regular and selected MAKEUP lessons at 390×844,
  validates 360px overflow, sticky action, reload persistence and unsaved warning.
- Existing M1 browser smoke remains in the same E2E command.

## Commands executed

- Read M2C task/acceptance and inspected current UI/routes/wireframes.
- `npm install -w client --save-dev --save-exact @playwright/test`
- `npm -w client run typecheck`; `npm -w client run lint`
- `npm run test:e2e` (diagnostic failure, then two passing full reruns)
- `npm run check:fast` (lint-global diagnostic failure, then passing rerun)
- `npm run check:repo`; `git diff --check`; UTF-8 scan

## Results

- `check:fast`: PASS; 19 unit tests, lint/typecheck/build all pass.
- `test:e2e`: PASS — M1 smoke plus Playwright regular/MAKEUP mobile flows.
- 39/39 Express routes continue to match OpenAPI.

## Manual browser verification

PASS — inspected `teacher-hub-m2c-mobile.png` rendered at 390×844. Four compact
step labels, confirmation content and sticky two-button action fit without
horizontal clipping; E2E also measured zero overflow at 360px.

## Known gaps

- No M2C blocker. Historical recalculation/conflict behavior remains M3.
- Existing Vite chunk-size warning increased after richer UI but remains non-failing.

## Documentation updated

- Frontend architecture and lesson feature now describe routes, server persistence and mobile states.

## Git status

M2A–M2C changes are uncommitted. During the session the index also showed the
pre-existing `AGENTS.md`/Excel files staged; they remain preserved and were not reverted.
