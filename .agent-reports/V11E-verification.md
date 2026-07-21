# V11E Verification Report

## Schema and bootstrap

PASS. Migration `0007` applied to existing test/development schemas, preserved
rows, backfilled unique usernames and allowed username-only bootstrap. The auth
E2E bootstrap created `auth-e2e` without an email address.

## API and security

PASS. Shared/OpenAPI/client/server contracts use username. Login lookup and
rate-limit normalization use username; password hashing and generic credential
errors remain. Browser tests found no raw password persistence.

## Homepage

PASS. Exactly one header “Quản trị” link targets `/admin/login`; no footer admin
link or © remains. The centered footer is exactly “2026 — từ người hâm mộ cô Vy, with love ❤️”.

## Login

PASS. The section heading is “Đăng nhập”; the semantic autocomplete=username
field is labeled “Tên đăng nhập”. Remembered and session-only flows, logout,
invalid bootstrap, show/hide password and short viewport behavior all pass.

## Regression

PASS. `npm run check:full` completed in 166.5 seconds, including builds,
typechecks, lint, unit/integration tests, the complete E2E chain and repository
consistency for 52 Express/OpenAPI routes.
After the bootstrap single-account safeguard was added, server typecheck and the
complete focused auth-session E2E passed again.

## Visual review

PASS at 390×844 and 1440×900. Four focused captures have zero horizontal
overflow and preserve the intended mobile and desktop layouts.

## Documentation consistency

PASS. Environment examples, Docker Compose, README, OpenAPI, authentication,
security, deployment and teacher guidance use `BOOTSTRAP_ADMIN_USERNAME` and no
longer require email.

## Remaining blockers

None for V11E. Real private credentials still need to be chosen by the owner;
this is intentionally not treated as permission to write or disclose them.

## Final verdict

PASS
