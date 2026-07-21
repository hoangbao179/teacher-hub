# UIB — Responsive shell and screen alignment

## Goal

Make the admin application a full-width mobile experience on small screens and
a coherent desktop web application from the `md` breakpoint upward.

## Scope

- Keep bottom navigation mobile-only and provide desktop side navigation.
- Use responsive content widths, bounded forms and multi-column layouts where
  they improve scanning.
- Calibrate Dashboard and every primary admin/public screen against the approved
  wireframe hierarchy and density direction.
- Preserve accessible targets, sticky-action reachability and zero horizontal
  page overflow.
- Add responsive browser assertions and final comparison screenshots.

## Exclusions

- New workflows, business-rule changes, enterprise data grids, MUI replacement
  and unrelated visual rewrites.

## Required verification

```bash
npm run check:fast
npm run test:e2e
npm run build
```

The checkpoint may proceed to UIC only after its verification report ends in
`PASS`.
