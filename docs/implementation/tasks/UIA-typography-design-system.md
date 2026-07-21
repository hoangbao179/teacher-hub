# UIA — Typography and design-system calibration

## Goal

Replace the oversized, heavy visual language with a compact, consistent,
Vietnamese-friendly MUI design system without changing V1 behavior.

## Scope

- Load a self-hosted Vietnamese-compatible UI font with `font-display: swap`.
- Centralize typography, spacing, radii, colors, elevation, icon, control,
  navigation and content-width tokens.
- Standardize shared presentation components and remove conflicting local type
  overrides where safe.
- Audit production UI labels for raw enum values and inconsistent terminology.
- Capture and review the required post-UIA screenshots.

## Exclusions

- Responsive shell redesign (UIB), business-rule changes, new product features,
  framework replacement and unrelated dependency upgrades.

## Required verification

```bash
npm run check:fast
npm run test:e2e
npm run build
```

The checkpoint may proceed to UIB only after its verification report ends in
`PASS`.
