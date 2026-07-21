# V12A Implementation Report

## Initial repository state

- Task ID: V12A.
- Base commit: `0ddf1bc` (`thay đổi luồng login, homepage cho đẹp hơn`).
- Initial worktree: clean.
- Existing migrations inspected through `0007_v11e_username_auth.sql`; no migration is needed for V12A.
- Baseline `npm run check:full`: PASS (36 unit passed, 20 integration passed, all seven prior E2E scripts and repository consistency passed).
- Baseline `npm run build`: PASS.
- 56 baseline screenshots captured across the eight required viewports under `.agent-reports/v1-2-baseline/`; manifest reports zero horizontal overflow.

## Problems found

- Mobile hero used a fixed 610px minimum, consumed the first viewport and hid discovery of the following section.
- A public development warning and placeholder contact copy were visible.
- Homepage had one static hero, not an accessible three-slide carousel.
- Testimonial model could not enforce verified/published safety.
- Program cards lacked the requested topic lists and visual differentiation.
- Placeholder contact targets rendered instead of being hidden.
- Footer copy was informal.

## Scope completed

- Completed every V12A source, safety, responsive, accessibility, test and media-documentation item.
- Core class/student/enrollment/lesson/tuition/schedule behavior was not changed.

## Homepage changes

- Added a configurable three-slide carousel with 5.5-second autoplay, previous/next, pagination, keyboard, pointer swipe, focus/hover/hidden-tab pause and reduced-motion behavior.
- First hero image is eager/high priority; later images are lazy and preloaded after initial render.
- Hero height is 470–500px at 360–393, 490–520px at 400–430, 540–580px at tablet and 620px desktop.
- Added restrained book/ABC/star/pencil/speech-bubble styling with narrow-width simplification.
- Added three topic-rich pastel program cards and retained no public tuition pricing.
- Removed global visitor-facing demo/config warnings and replaced the footer with professional Huế copy.

## Admin/Login changes

None; V12B scope.

## Authentication changes

None; V12C scope.

## Documentation changes

- Added V12A–V12E task and acceptance documents before checkpoint implementation.
- Added `docs/content/replacing-public-media.md` covering hero variants/focal points/alt, video/poster/thumbnail policy, contact/base URL, teacher photo and real testimonial replacement.

## Visual reference changes

- Added non-committed V12A review screenshots for all required mobile widths and desktop under `.agent-reports/v1-2-homepage/`.
- V2 committed visual references remain V12D scope.

## Tests added

- Expanded production config self-test for testimonial schema, safe empty fallback and rejection of published unverified quotes.
- Replaced Homepage E2E with carousel/manual/autoplay/swipe/reduced-motion, hero-height, next-section discovery, contact, testimonial fallback/draft badge, public-price, metadata, overflow and screenshot checks.
- Production config self-test now runs at the start of the E2E suite.

## Commands executed

- `npm run check:full` (baseline)
- `npm run build` (baseline)
- baseline capture command for seven screens × eight viewports
- `npm -w client run typecheck`
- `npm -w client run lint`
- `npm -w client run validate:public:self-test`
- `node client/scripts/public-homepage.e2e.mjs`
- `npm run check:fast`
- `npm run test:e2e`
- `npm run build`
- UTF-8 corruption scan for changed V12A content/docs

## Results

- Fast gate: PASS; 36 unit tests passed, 20 integration tests correctly skipped by the unit command, typecheck/lint/build passed.
- Full E2E: PASS, including Homepage, auth sessions, navigation, CRUD smoke, lesson wizard, tuition/payment/export and schedule operations.
- Final build: PASS.
- Public validation self-test: PASS.
- UTF-8 scan: no matches.

## Manual mobile review

- Inspected 360×800 and 390×844 full-page screenshots.
- Hero/controls/CTA fit, following section is visible, program/fallback/contact cards remain readable, and no decoration overlaps content.
- Screenshot and E2E metrics show zero horizontal overflow across 360, 375, 390, 393, 400, 412 and 430 widths.

## Manual desktop review

- Inspected 1440×900 full-page screenshot.
- Hero remains balanced at 620px; content uses the desktop width and three-column cards without a phone-shell layout.

## Known gaps

- Public images are temporary and documented for replacement by approved real media.
- Development testimonials remain drafts and are visibly labeled; production publishes none until verified and published flags are both true.
- Real Zalo/phone/Facebook/public URL must be supplied before production.

## Git status

- Modified: public content, Homepage, Vite env types, environment example, production validator, Homepage E2E and client E2E script.
- Added: task/acceptance docs, media replacement guide and V12A reports.
- No migration added.
