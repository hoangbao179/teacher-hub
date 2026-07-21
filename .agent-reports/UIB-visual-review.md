# UIB Visual Review

The baseline set is in `.agent-reports/ui-baseline/`. The calibrated set is in
`.agent-reports/ui-final/`. Each primary screen was inspected at 390×844,
414×896, 768×1024 and 1440×900; the final set contains 56 PNG files and every
capture measured zero page-level horizontal overflow.

## Dashboard

- Baseline problem: oversized metrics and a narrow phone column on desktop.
- Change: compact three-card metrics, restrained actions and a responsive event grid.
- Mobile result: alerts and the schedule remain first-class in one readable column.
- Desktop result: sidebar, wide content and two schedule columns use the viewport.
- Remaining limitation: unusually long seeded names wrap, without clipping or overflow.

## Class list

- Baseline problem: sparse full-width cards inside a narrow centered shell.
- Change: compact cards and a two-column grid only when the available width is sufficient.
- Mobile result: status, price and primary add action remain visible without scrolling sideways.
- Desktop result: two scanning columns at 1440px; 768px intentionally stays one column.
- Remaining limitation: synthetic timestamp-heavy seed names are longer than real names.

## Class detail

- Baseline problem: heavy title/actions and weak desktop content alignment.
- Change: bounded detail content, compact action grouping and consistent cards/progress.
- Mobile result: lesson and lifecycle actions stay reachable above bottom navigation.
- Desktop result: a readable 900px detail region aligns within the desktop shell.
- Remaining limitation: the one-student fixture naturally leaves unused vertical space.

## Student list

- Baseline problem: dense content used a narrow mobile-only column at every width.
- Change: compact progress cards and a responsive grid with a wide-screen breakpoint.
- Mobile result: enrollment, status and progress are legible in one column.
- Desktop result: two columns improve scanning at 1440px; 768px avoids cramped cards.
- Remaining limitation: E2E seed identifiers wrap more than normal student names.

## Student detail

- Baseline problem: mobile full-width action treatment was simply enlarged on desktop.
- Change: bounded content and responsive action rows with clear destructive emphasis.
- Mobile result: actions remain large enough to touch and ordered by importance.
- Desktop result: actions become compact rows while detail/progress cards use the width.
- Remaining limitation: sparse fixture content leaves intentional whitespace.

## Lesson wizard

- Baseline problem: oversized fields and a phone-width desktop form.
- Change: 680px bounded form, compact controls, grouped time fields and calibrated step labels.
- Mobile result: single-column flow and sticky primary action sit above bottom navigation.
- Desktop result: centered form remains readable rather than stretching across the shell.
- Remaining limitation: the wizard retains a local sticky wrapper because replacing it with
  the shared wrapper caused a verified React click regression.

## Tuition list

- Baseline problem: filters and cards did not use desktop space effectively.
- Change: compact grouped filters and a two-column due-cycle grid at large widths.
- Mobile result: amount, progress and both actions remain visible per card.
- Desktop result: two-column comparison reduces scrolling without introducing a table.
- Remaining limitation: tabs may horizontally scroll on very narrow screens by MUI design.

## Tuition detail

- Baseline problem: eight lesson rows formed a long sparse desktop column.
- Change: bounded detail, compact summary and two-column lesson grid from tablet upward.
- Mobile result: chronological cards and payment action remain touch-friendly.
- Desktop result: all eight sessions are substantially easier to scan.
- Remaining limitation: full-page screenshots place the sticky bar over stitched image
  segments; runtime tests confirm it does not overlap the mobile navigation.

## Mark-paid form

- Baseline problem: unconstrained desktop form and visually tall controls.
- Change: centered 680px form, compact fields, grouped payment options and warning.
- Mobile result: complete payment context and confirmation fit the natural flow.
- Desktop result: the form stays bounded with a clear primary action.
- Remaining limitation: V1 correctly supports only full payment.

## Reconciliation

- Baseline problem: long occurrence list wasted desktop width.
- Change: bounded filters and a large-screen two-column occurrence grid.
- Mobile result: each occurrence remains an actionable card with no wide table.
- Desktop result: two columns improve batch scanning and keep warnings attached to items.
- Remaining limitation: large seeded weeks remain long by nature.

## Weekly calendar

- Baseline problem: a phone list floated in a wide desktop viewport.
- Change: responsive day grid, compact schedule rows and desktop shell integration.
- Mobile result: chronological single-column agenda remains the approved interaction.
- Desktop result: days form useful columns where content permits.
- Remaining limitation: desktop drag/drop remains explicitly outside V1.

## Busy-slot form

- Baseline problem: full viewport width on desktop and loose vertical spacing.
- Change: bounded form, FormSection grouping and compact related date/time inputs.
- Mobile result: all inputs and save action fit without horizontal overflow.
- Desktop result: centered form preserves a clear reading line.
- Remaining limitation: disabled save is expected until required title input is supplied.

## Public Homepage

- Baseline problem: heavy display typography and less effective wide-screen composition.
- Change: calibrated type, balanced hero/media columns, compact testimonials and CTAs.
- Mobile result: content wraps cleanly and the fixed CTA remains reachable.
- Desktop result: hero and supporting sections make purposeful use of the page width.
- Remaining limitation: production marketing values are addressed in UID.

## Login

- Baseline problem: default-MUI typography and spacing lacked product consistency.
- Change: calibrated title/body/control scale and bounded authentication card.
- Mobile result: form is readable with accessible targets.
- Desktop result: a deliberately bounded login surface remains appropriate for authentication.
- Remaining limitation: none within UIB scope.
