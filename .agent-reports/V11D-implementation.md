# V11D Implementation Report

## Initial repository state

V11D began only after V11A, V11B and V11C recorded PASS. The initial repository
was clean before V11A; at this checkpoint the working tree contained only their
cumulative scoped source, documentation, E2E and image changes. No migration was
pending, added or edited.

## Scope completed

Completed release-level consistency checks for the Cô Vy English branding,
public configuration, secure authentication persistence, mobile navigation,
documentation, source packaging and final mobile/desktop visual evidence.

## Branding changes

Production Docker build arguments, Compose arguments, the deployment environment
example and client Vite types now use the same Cô Vy/English public content keys
as the application source. The obsolete subject-line variable was removed and
the Open Graph image variable is carried through the production build.

## Public content changes

The deployment example now mirrors the approved grade 1–9 English programs,
Nguyễn Tri Phương service area, hero media and SEO fields. Development-only
contact/domain placeholders remain explicitly marked and are rejected by the
production validator. Public documentation explains the central configuration
and placeholder behavior.

## Login changes

The completed V11B login is covered by the full release regression: public-home
return, Cô Vy identity, semantic fields, show/hide password, loading/errors,
remember choice, short mobile viewport behavior, authenticated guest redirect
and logout/session-expiry handling.

## Auth-storage changes

The application reads and clears tokens through `client/src/auth/authStorage.ts`.
Remembered sessions use local storage, non-remembered sessions use session
storage, and the stores are mutually exclusive. Only explicitly remembered email
and preference metadata persist separately. Deterministic repository and package
scans reject raw-password persistence through Web Storage, cookies, IndexedDB,
client configuration or console logging.

## Navigation changes

The completed V11C five-item mobile navigation remains equal-width,
safe-area-aware and stable across selected states; Học sinh uses a Person icon.
Desktop retains its sidebar. Final regression also covers quick actions, student
navigation, refresh persistence and sticky-action separation.

## Mobile-device validation

Final captures cover public home, login, dashboard, class list, student list,
tuition list and weekly calendar at 360×800, 375×812, 390×844, 393×852,
412×915, 414×896 and 430×932. All 56 mobile/desktop captures report zero
horizontal overflow.

## Tests added

- Expanded the production public-config validator self-test with placeholder
  teacher/Zalo/E.164/base-URL and missing-SEO cases plus confidential-output checks.
- Added shared raw-password persistence rules to repository and packaged-source
  inspection, including rejecting storage, cookie, IndexedDB, public config and
  logging examples while allowing an in-flight login request.
- Kept the dedicated auth-session and mobile-navigation E2E suites in the full
  regression command.

## Files changed

- Production configuration: `Dockerfile.web`, `docker-compose.prod.yml`,
  `deploy/env.example`, `client/src/vite-env.d.ts`.
- Validation/package hygiene: `client/scripts/validate-public-config.mjs`,
  `scripts/package-rules.mjs`, `scripts/check-repo.mjs`,
  `scripts/check-package.mjs` and the safe E2E fixture in
  `client/scripts/mobile-navigation.e2e.mjs`.
- Documentation: public-home, authentication, production, security,
  known-limitations, teacher guide, acceptance, status and release checklist.
- Evidence: `.agent-reports/v1-1-final-screenshots/` and the V11D reports.

## Migrations added

None.

## API and contract changes

None. No shared DTO, OpenAPI operation, database schema or server business API
was changed in V11D.

## Business rules affected

None. Lesson attendance, eight-session tuition cycles, payment locking,
enrollment history and schedule reconciliation retain their existing semantics.

## Commands executed

- `npm ci` (first attempt blocked by the running workspace Vite binding; the
  exact workspace dev process was stopped, then the clean install passed)
- production-only `npm audit --omit=dev --json` review
- `npm -w client run validate:public:self-test`
- `npm run check:repo`
- `npm run check:full`
- `docker version --format '{{.Server.Version}}'`
- final seven-screen/eight-viewport `capture-ui.mjs` run
- `npm run package:source` and `npm run check:package` (the first inspection
  exposed a safe E2E fixture false positive; it was relabeled explicitly as E2E,
  then both commands passed)
- final `git diff --check`, UTF-8 scan and repository status review
- restored the original hidden workspace dev process after clean-install testing;
  web and API health checks both returned HTTP 200

## Results

Clean install passed. `check:full` passed, including typechecks, lint, builds,
unit/integration tests and the complete E2E chain. Public validator and repository
scans passed. The final controlled archive contains 356 entries and passes package
inspection at `release/teacher-class-hub-source-0.1.0.tar.gz` with SHA-256
`1ce69831b50a92421fdd03e77830d87f47a097a067397e697ed097de35e1bc3c`.
The previously running development environment was restored on ports 5173 and
4000 after verification.

## Manual mobile review

Directly inspected final public home, login, Dashboard and student list at
390×844, supplemented by the V11C all-tab review at 390×844, 393×852 and
412×915. Branding, labels, actions and cards remain readable; navigation does
not cover sticky actions and no horizontal clipping is visible.

## Manual desktop review

Directly inspected the same four final screens at 1440×900. Homepage hero/content,
centered login, permanent admin sidebar, metrics and two-column student cards are
preserved without a mobile shell or horizontal overflow.

## Known gaps

- Real production phone, Zalo, Facebook and public domain values were not supplied;
  development placeholders are clearly labeled and production validation rejects them.
- Docker Desktop's Linux engine was unavailable, so no Compose build was run or claimed.
- Production dependency audit reports two moderate advisories and zero high/critical;
  the full dependency tree additionally contains two high development-tool advisories.
- Physical iOS/Android hardware was not used; deterministic Chromium viewport and
  CSS safe-area coverage was completed.
- This checkpoint does not constitute production approval and did not start the
  required independent full-system review.

## Documentation updated

Updated public-home configuration, authentication/security behavior, production
build variables, teacher login/shared-device guidance, known limitations,
checkpoint acceptance/status and release checklist.

## Git status

The working tree contains cumulative scoped V11A–V11D changes and generated
review artifacts/package only. There were no unrelated pre-existing changes,
no migration changes and no commits were created.
