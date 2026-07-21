# V12B — Login and Admin visual polish

## Goal

Làm Login và Admin ấm áp, có chất giáo dục nhưng bình tĩnh hơn Homepage và giữ nguyên dữ liệu/API thật.

## Scope

- Login copy, decoration, spacing, safe areas and keyboard usability.
- Authenticated Dashboard greeting and pastel metric hierarchy.
- Class/student card accents, stable avatar/progress/status presentation.
- Four lesson-wizard step accents that do not rely only on color.
- Consistent Vietnamese tuition status colors; no raw enums.
- Mobile bottom navigation, sticky actions and desktop sidebar regression.

## Out of scope

Fake operational data, MUI replacement, business-flow redesign and animated operational cards.

## Verification gate

`npm run check:fast`, `npm run test:e2e`, `npm run build`, screenshots under `.agent-reports/v1-2-admin/`, then V12B verification report.
