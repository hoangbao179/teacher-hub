# M6C — System-wide UI, accessibility and performance polish

## Goal

Polish every implemented V1 route into one coherent, mobile-first and practically
WCAG 2.2 AA-compatible experience without changing approved business behavior.

## Scope

- Review all public and protected routes against P0 wireframe hierarchy.
- Centralize design tokens and the approved reusable UI component vocabulary.
- Replace visible raw enums with consistent Vietnamese labels.
- Standardize loading, empty, error, confirmation, status and sticky-action states.
- Preserve accessible labels, focus behavior, announcements and touch targets.
- Keep business lists card-based on mobile with no page-level overflow.
- Keep the admin shell, active bottom navigation, deep links and persisted drafts.
- Add public and protected not-found experiences and retain accessible logout.
- Expand browser regression checks across critical mobile flows and viewport sizes.
- Capture representative 390×844 screenshots outside source-controlled assets.
- Confirm route splitting, media loading and production bundle output remain healthy.

## Exclusions

- Business-rule rewrites, new framework adoption, pixel-perfect generated-wireframe
  reproduction, desktop drag/drop calendar and features outside approved V1.

## Required verification

```bash
npm run check:fast
npm run test:e2e
npm run build
```

Every primary route must also be manually reviewed at 390×844. M6D must not begin
until the M6C verification report ends in `PASS`.
