# V11C — Mobile navigation and admin polish

## Goal

Make all five mobile navigation actions fit at 360px and lightly personalize Dashboard and student cards without changing workflows.

## Scope

- Standardize bottom-navigation label/icon sizing, equal widths, no-wrap behavior and safe-area spacing.
- Use a person/student icon for Học sinh and preserve desktop sidebar behavior.
- Apply Cô Vy admin branding and authenticated display-name greeting.
- Add restrained pastel Dashboard cards and compact student-card details.
- Verify navigation, overflow, sticky actions and desktop/mobile visibility at all target viewports.

## Out of scope

No workflow redesign, fabricated students, new dashboard data, or business API changes.

## Verification gate

`npm run check:fast`, `npm run test:e2e` and `npm run build` must pass. Required viewport screenshots and manual mobile/desktop review must be complete.
