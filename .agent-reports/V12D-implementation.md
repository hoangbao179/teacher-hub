# V12D Implementation Report

## Initial repository state

- V12A–V12C ended in `PASS`; base commit remained `0ddf1bc` with their cumulative changes present.
- Current docs still described obsolete hero/demo/password behavior and had no V2 screenshot policy/set.
- `docs/design/` and the Admin UI feature document did not exist; V1.1 was the latest status entry.
- Independent full-system review was correctly NOT STARTED; no migration was planned.

## Problems found

- Product, feature and teacher-facing docs did not fully match the Cô Vy V1.2 implementation.
- P0 wireframes had no explicit historical/workflow boundary relative to current-app styling.
- Deploy media/testimonial wiring did not cover all new public fields.
- Repository consistency checks could not detect the requested stale visible statements.

## Scope completed

- Synchronized active product/feature/teacher/design docs with the running V12A–V12C behavior.
- Defined P0 versus V2 visual authority in docs and AGENTS.md.
- Added eight real-app V2 references with route/state/viewport/supersession metadata.
- Updated deploy wiring, status/roadmap/limitations and repository consistency checks.

## Homepage changes

No new component behavior; documentation and deploy wiring now describe/support the three-slide carousel, temporary media, programs, safe testimonials and contact priority.

## Admin/Login changes

No new UI behavior; the new Admin UI and design docs record the restrained pastel mappings, mobile-first navigation and supported widths.

## Authentication changes

No new auth code; current docs now describe the six-character default, explicit bootstrap/reset, in-memory limiter, visible Retry-After countdown and raw-password prohibition.

## Documentation changes

- Updated product specs 01/02/03/06/10, README files, authentication/deployment/security/current-state docs and teacher guide.
- Added `docs/features/public-homepage.md`, `docs/features/admin-ui.md`, `docs/design/ui-guidelines.md` and `docs/content/replacing-public-media.md`.
- Removed the obsolete `docs/features/public-home.md` in favor of the current filename.

## Visual reference changes

- Preserved all 18 P0 PNGs as historical workflow references.
- Added `docs/wireframes/v2-branding/01`–`08` from actual browser captures plus metadata and synthetic-data disclosure.
- Mobile references use a 390×844 viewport; Homepage desktop uses 1440×900; full-page height is documented.

## Tests added

- Extended `scripts/check-repo.mjs` to require current docs and all eight V2 PNGs.
- Added self-tested stale checks for teacher/math/hero/password/limiter/wait/visual-authority statements while excluding marked history.

## Commands executed

- Scoped `rg` documentation/source searches
- Controlled copy of eight existing real-app captures
- PNG dimension decode and manual visual inspection
- `npm run check:repo`, `npm run check:fast`, `npm run build`
- UTF-8 scan and `git diff --check`

## Results

- Final repository check: PASS, 52 Express routes matched OpenAPI.
- Fast gate and standalone build: PASS; eight required PNGs exist and decode at the documented widths.
- The first checker run exposed its own non-Unicode Vietnamese word-boundary bug; the regex/self-test was corrected and final checks passed.

## Manual mobile review

Homepage, Login, dashboard, student list, bottom navigation, lesson wizard and tuition list sources were inspected. The copied navigation reference shows five one-line labels, active state and no private content.

## Manual desktop review

Homepage and Admin desktop sources preserve their wide layouts and current V12 styling.

## Known gaps

- Public media/contact values remain temporary/operator-configured before production.
- V2 covers eight requested views, not every route/state; P0 still governs workflow where not superseded.
- Independent full-system review remains NOT STARTED.

## Git status

- Working tree contained cumulative V12A–V12D changes and eight approved docs PNGs.
- No P0 image was moved/deleted and no migration was added.
