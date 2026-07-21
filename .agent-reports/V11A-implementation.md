# V11A Implementation Report

## Initial repository state

Git status was clean. Baseline Node/npm were 24.18.0/12.0.1. The repeated baseline `npm run check:full` and separate `npm run build` passed after a stale Vite process from an interrupted first run was removed. Forty-nine baseline captures were stored in `.agent-reports/v1-1-baseline/`.

## Problems found

Public source still named Cô giáo An, described mathematics programs/videos, used fake contact/domain values, and exposed Teacher Class Hub as initial metadata. The old hero contained geometry props. New-class subject was blank. Renaming seed classes initially broke repeat-seed behavior; this was corrected with a DEV_SEED-only upgrade step and verified by running the seed twice.

## Scope completed

Completed the V11A branding, public content, metadata, public validation, English default/seed, documentation, E2E and screenshot scope.

## Branding changes

Visible public brand is “Lớp học cô Vy”; teacher name is “Cô Vy”; subject/level line is “Tiếng Anh Lớp 1–9”. A new English-study hero was generated without a person or fabricated identity.

## Public content changes

Added the required grade 1–5, grade 6–9 and tutoring/exam content, including phonics, pronunciation, vocabulary, grammar, reading, writing, school-program reinforcement, tests, mất gốc and correctly spelled Nguyễn Tri Phương. Public tuition remains absent. Demo testimonials are explicitly labeled and rejected for production.

## Login changes

None; reserved for V11B.

## Auth-storage changes

None; reserved for V11B.

## Navigation changes

None; reserved for V11C.

## Mobile-device validation

Automated overflow and full-page captures passed at 360×800, 375×812, 390×844, 393×852, 412×915 and 430×932. Desktop capture passed at 1440×900.

## Tests added

Homepage E2E now asserts Cô Vy branding, old-brand/math absence, Nguyễn Tri Phương, no public prices, contact links, exact SEO metadata and responsive overflow. Public validator self-test now covers placeholder domain and old teacher rejection.

## Commands executed

- `npm run check:full` baseline (first run environmental port collision; repeated run PASS)
- `npm run build` baseline (PASS)
- `node client/scripts/capture-ui.mjs ...` baseline capture (PASS)
- `npm -w client run validate:public:self-test` (PASS)
- `npm -w client run typecheck` (PASS)
- `npm -w client run lint` (PASS)
- `npm -w server run db:seed:dev` twice (PASS)
- `npm run check:fast` (final PASS)
- `npm run test:e2e` (final PASS)
- `npm run build` (final PASS)
- `git diff --check` (PASS)
- UTF-8 mojibake scan (only the literal diagnostic pattern in AGENTS.md matched)

## Results

All V11A gate commands pass. No shared contract, API or business allocation rule changed.

## Manual mobile review

Inspected 360×800 and 390×844 captures. Hero copy, CTAs, English programs, methods, sample feedback disclosure and contact section are readable with no horizontal overflow.

## Manual desktop review

Inspected 1440×900. Header, wide hero composition, three-column content and footer remain coherent without a narrow phone shell.

## Known gaps

Real phone, Zalo, Facebook and production domain were not supplied. Development placeholders remain visibly labeled and production validation rejects them.

## Documentation updated

Added V11A–V11D task/acceptance documents; updated README, public-home feature documentation and implementation status.

## Git status

Working tree contains the scoped V11A source/docs/assets plus pre-created V11B–V11D task/acceptance documents; no unrelated pre-existing changes were present.
