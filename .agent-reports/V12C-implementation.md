# V12C Implementation Report

## Initial repository state

- V12A and V12B ended in `PASS`; base commit remained `0ddf1bc` with their cumulative changes present.
- Bootstrap used a conflicting hard-coded 10-character minimum; limiter defaults were fixed and the client wait message was indefinite.
- No password-reset command existed and Vite could silently select a fallback port.
- Existing audit columns supported the new reset event without migration.

## Problems found

- Password policy was duplicated/inconsistent across operational paths.
- Administrators had no safe audited reset flow.
- The 429 response did not yield an actionable browser countdown because `Retry-After` was not CORS-exposed.
- Testability and local recovery of the in-memory limiter were limited.

## Scope completed

- Centralized auth settings/password validation and added a transactional audited admin reset.
- Made login limiting configurable/testable, exposed and parsed `Retry-After`, and added an accessible countdown.
- Preserved form fields, disabled/re-enabled submit deterministically and enabled strict Vite ports.
- Added unit, integration and browser coverage plus operating documentation.

## Homepage changes

None; public content behavior remained the verified V12A implementation.

## Admin/Login changes

- Login now displays a warning countdown, preserves username/masked password and disables submit until retry is allowed.
- The countdown is announced to assistive technology and submit automatically re-enables at zero.

## Authentication changes

- Password minimum is centrally validated and defaults to 6 for bootstrap and reset.
- `npm run admin:reset-password` supports hidden interactive input or three required automation variables, bcrypt cost 12, a transaction and a secret-free `ADMIN_PASSWORD_RESET` audit event.
- Limiter defaults are development/test 60s/20 failures and production 300s/10 failures; success clears the key and same-process reset can clear a username.
- CORS exposes `Retry-After`; Vite port use is strict.

## Documentation changes

Updated env examples, authentication, local development, production, troubleshooting and security guidance for bootstrap/reset, limiter, countdown, strict port and known constraints.

## Visual reference changes

Added `.agent-reports/v1-2-admin/login-rate-limit-390x844.png` from the running auth E2E flow.

## Tests added

- Unit coverage for password acceptance/rejection, auth-setting defaults/validation, limiter calculation/clearing and Retry-After parsing.
- MySQL integration coverage for hash update, old/new login, audit contents and HTTP limiter behavior.
- Auth E2E for bootstrap/reset, six-character login, 401/429/countdown/expiry, storage safety and screenshot capture.

## Commands executed

- `npm run typecheck`, `npm run lint`, `npm run test`
- Isolated and full `npm run test:integration`
- Auth-session E2E during implementation and after screenshot capture
- Occupied-port strict Vite verification
- `npm run check:fast`, `npm run test:e2e`, `npm run build`
- Active-old-value scan and `git diff --check`

## Results

- Final `check:fast`: PASS (44 server unit and 2 client unit tests).
- Full integration: PASS, 21/21. Complete E2E and build: PASS. Strict-port negative check: PASS.
- Intermediate type/lint/test cleanup, missing pool cleanup and missing CORS exposure were fixed and recorded; all final gates passed.

## Manual mobile review

The 390×844 rate-limit state was inspected: warning/countdown fit the card, both credential fields remained populated/masked and submit was visibly disabled.

## Manual desktop review

Desktop Login remained centered and usable; strict-port verification confirmed a second Vite process exits instead of silently moving from 5173.

## Known gaps

- Limiter storage is intentionally single-process memory; multi-instance deployment needs a shared store.
- A separate CLI process cannot clear a running API process's memory; documented development restart remains available.
- Six characters is a deliberately minimal V1 default and should be strengthened before broader exposure.

## Git status

- Working tree contained cumulative V12A–V12C source/docs/reports; no migration was added.
- A pre-existing user Vite PID 29424 on 5173 was observed at report time and was not stopped during V12C.
