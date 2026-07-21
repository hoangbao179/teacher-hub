# V11E Implementation Report

## Initial repository state

V11E began from a clean working tree containing the completed V11A–V11D baseline;
there were no unrelated pre-existing edits. Migration `0006` was the latest
migration before this checkpoint.

## Scope completed

Removed only the footer admin-login link and the copyright line while preserving
the header “Quản trị” entry, added the requested 2026 fan dedication with heart, simplified the login heading, and
changed authentication/bootstrap from required email to configured username and
password. Bootstrap renames the sole legacy admin when necessary rather than
silently creating a second production account.

## Files changed

- UI/auth: `HomePage.tsx`, `LoginPage.tsx`, `AuthContext.tsx`, `authStorage.ts`.
- Shared/server: auth contract, controller, service, repository, rate limiter,
  bootstrap script and affected integration fixtures.
- Schema/API: migration `0007_v11e_username_auth.sql` and OpenAPI login request.
- Config/docs/tests: README, env examples, Compose, authentication/security/
  deployment/teacher docs, Homepage/auth/all dependent E2E fixtures, task,
  acceptance, status and release checklist.

## Migrations added

`0007_v11e_username_auth.sql` adds a unique username, backfills existing users
from their unique lowercase email, makes username required, and makes the legacy
email column optional. It was applied successfully to the test and development
databases without resetting business data.

## API and contract changes

`POST /api/auth/login` now accepts `{ username, password }`. `AuthUser`, the JWT
payload and `/api/auth/me` expose `username` instead of `email`. OpenAPI and the
shared source-of-truth contract were updated together.

## Business rules affected

No class, lesson, attendance, tuition, payment or schedule rule changed. The V1
single-teacher boundary remains; this change only replaces its login identifier.

## Security behavior

Passwords remain bcrypt-hashed with cost 12 and are never persisted in browser
storage. The rate limiter now keys failures by IP plus normalized username.
Remembered login stores username and the token according to the existing
local/session choice; the obsolete remembered-email key is removed on save/clear.

## Commands executed

- shared build; server/client typecheck; client lint
- focused auth-session and public Homepage E2E
- `npm run db:migrate` against the development database
- `npm run check:full` (PASS in 166.5 seconds)
- final server typecheck and auth-session E2E after tightening single-account bootstrap
- focused final capture at 390×844 and 1440×900
- final repository, UTF-8 and diff checks

The first client typecheck identified an MUI `textAlign` prop placement error;
moving it into `sx` resolved the issue. An initial full-check invocation was cut
off by an intentionally short tool timeout before tests completed; the complete
rerun passed.

## Test results

All final gates pass. Full regression includes shared/server/client builds,
lint, unit, integration, public/auth/mobile/core-business E2E and 52-route
OpenAPI consistency.

## Manual UI verification

Directly inspected Homepage and Login at 390×844 and 1440×900. Footer copy,
heart, preserved header admin link, removed footer admin link, simplified heading and username field are
visible with zero horizontal overflow.

## Known gaps

No real username/password was written to the private `server/.env`. Existing
users can initially use their prior email value as the backfilled username;
operators may set `BOOTSTRAP_ADMIN_USERNAME` and a password of at least ten
characters, then run the documented bootstrap command. The independent
full-system review remains outside this follow-up.

## Current git status

The working tree contains only scoped V11E changes: one new forward migration,
auth/footer source changes, tests, docs and reports. No commit was created.
