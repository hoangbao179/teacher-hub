# UID Implementation Report

## Initial repository state

- UID began only after the UIC verification report ended in PASS.
- Repository commit was `5294f53`; expected UIA/UIB/UIC changes were present.
- Three untracked legacy workbooks containing private student data were under
  `docs/reference/legacy-excel/`; no migration was added or edited.
- The workspace had active user development processes holding a native Rolldown
  binding open, so verification used an isolated packaged-source snapshot.

## Baseline problems

- Ignore rules and release packaging did not cover every env, build, browser, dump,
  backup, log, screenshot and private-workbook class required by UID.
- No deterministic source archive/checksum or archive content scanner existed.
- Public marketing defaults could look real and production builds did not require
  validated teacher/contact/media/SEO values.
- Proxy security headers, credential-rotation guidance and measured-capacity/backup
  procedures were incomplete.

## Scope completed

- Hardened Git/Docker excludes and added allowlisted source packaging with checksum.
- Moved private workbooks to ignored `.private-data/legacy-excel/` and documented the
  safe local location.
- Added deterministic repository/package self-checks for every prohibited class.
- Added explicit demo labeling and mandatory production public-config validation.
- Added compatible Nginx headers and completed capacity, backup, restore, HSTS and
  secret-rotation guidance.

## Files changed

- `.gitignore`, `.dockerignore`, `package.json`, `scripts/check-repo.mjs`.
- `scripts/package-rules.mjs`, `scripts/package-source.mjs`,
  `scripts/check-package.mjs`.
- `client/.env.example`, `client/package.json`, `client/index.html`,
  `client/scripts/validate-public-config.mjs`, `client/src/content/publicHome.ts`,
  `client/src/pages/HomePage.tsx`, `client/src/vite-env.d.ts` and Homepage E2E.
- `Dockerfile.web`, `docker-compose.prod.yml`, `deploy/env.example`,
  `deploy/nginx.conf`.
- `README.md`, deployment/security/release/legacy-workbook documentation and UID
  task, acceptance, status and report files.

## Design-system changes

- No shared token change. The public page gained a restrained development-only
  information banner; a duplicated fixed mobile CTA was removed after visual review
  showed it obscuring content at 390 px.

## Responsive changes

- The Homepage retains responsive hero/content/CTA layouts at mobile and desktop
  without the overlapping fixed mobile contact bar.

## Correctness fixes

- Production marketing data is parsed from explicit typed environment fields and a
  production build fails before bundling if mandatory values are missing or resemble
  placeholders.

## Cleanup performed

- Moved `Hoài Nhi (Gini)- Grade 3.xlsx`, `Ken-grade 3.xlsx` and
  `Kiệt (Boy) Grade 5.xlsx` out of source documentation into the ignored local
  `.private-data/legacy-excel/` directory. The move is recoverable from that location.
- Kept only guidance in `docs/reference/legacy-excel/README.md`; generic import remains
  out of scope.

## Packaging/security changes

- The source packager includes controlled Git/untracked source allowlists, records base
  commit/dirty state, emits SHA-256 and excludes reports, private data and generated output.
- The package checker verifies checksum/path rules and scans likely secret content without
  printing matched values; adversarial and approved-example self-tests run on every check.
- CSP permits same-origin app/API assets, YouTube privacy-enhanced frames and approved
  thumbnails while disallowing inline script; frame, referrer, permissions and MIME headers
  apply to HTML and static assets. HSTS remains an outer TLS-proxy responsibility.

## Tests added

- Package-rule adversarial path/content self-tests and archive inspection.
- Repository checks for real env files, workbooks, encoded filenames, generated images,
  obsolete placeholders and unsafe packaging markers.
- Public marketing validator positive/negative fixtures and E2E demo-label assertion.

## Commands executed

- Ignore/path/workbook/archive audits with `git`, `rg`, `git check-ignore` and `tar`.
- `npm ci` in an isolated extracted source snapshot.
- `npm audit --omit=dev --audit-level=high`.
- `npm run check:fast`; `npm run check:full` (isolated snapshot).
- `npm -w client run validate:public:self-test` and a fixture-backed
  `npm -w client run build:production`.
- `docker compose -f docker-compose.prod.yml config --quiet`; Docker engine probe.
- `npm run package:source`; `npm run check:package`; explicit archive listing counts.
- Browser capture at 390×844, 414×896, 768×1024 and 1440×900.

## Results

- Clean `npm ci`: PASS, 439 packages installed from lockfile.
- Latest UID `check:full`: PASS in 97.4 seconds; 36 unit tests, 20/20 integration
  tests, all five browser E2E suites, builds and 52-route OpenAPI check passed.
- Production audit: 2 moderate transitive ExcelJS/UUID findings, 0 high/critical;
  the accepted limitation and no-force-upgrade decision are documented.
- Production marketing self-test/build and Compose configuration: PASS.
- Source package: PASS, 342 archive entries, zero prohibited env/Git/dependency/dist/
  workbook entries. Docker build was not run because the Docker Desktop Linux engine
  pipe was unavailable.

## Manual mobile review

- Reviewed every required public/admin screen at 390×844 and 414×896. Vietnamese
  diacritics render correctly, overflow is zero and the public demo banner is explicit.
- Removed the fixed public CTA after the 390 px capture exposed content overlap, then
  recaptured and reviewed the corrected Homepage.

## Manual desktop review

- Reviewed every required screen at 1440×900; the public layout uses its full content
  hierarchy and admin screens retain sidebar navigation and bounded forms.

## Known gaps

- Docker image/start verification remains for an environment with a running Docker
  Desktop Linux engine; Compose interpolation itself passed.
- NPM production audit retains two documented moderate transitive ExcelJS/UUID findings;
  the available automated fix is breaking and was not applied in this scoped task.
- Real production `PUBLIC_*` values, capacity measurements and an independent full-system
  review remain deployment/reviewer responsibilities.

## Documentation updated

- README packaging use, production public configuration, release checklist, legacy data,
  security/HSTS/rotation and backup/restore/capacity procedures are synchronized.

## Git status

- UID changes are present alongside expected UIA/UIB/UIC work on commit `5294f53`.
- Private workbooks and generated package/screenshots are ignored; no migration changed.

