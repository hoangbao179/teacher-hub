# V12C Verification Report

## Acceptance checklist

All V12C items passed: one six-character policy, safe reset, validated limiter settings, Retry-After/countdown, strict Vite port, placeholder-only env examples and no raw-password persistence.

## Typecheck

Final typecheck passed after correcting two test-only typing mistakes.

## Lint

Final lint passed after making the countdown effect dependency deterministic.

## Unit tests

Final fast gate passed 44 server and 2 client unit tests, including the new password/settings/limiter/parser cases.

## Integration tests

`npm run test:integration`: PASS, 21/21, after adding deterministic pool cleanup to the new reset test.

## E2E tests

Complete E2E passed; isolated auth E2E verified old-password rejection, six-character login, 429 countdown, expiry, re-enable and storage safety.

## Build

`npm run build`: PASS. Occupied-port verification exited 1 as expected and did not start Vite on 5174.

## Homepage review

Homepage remained unchanged and public E2E continued to pass.

## Admin/Login review

The warning-toned finite countdown fit the mobile Login card and preserved credentials without revealing the password.

## Authentication behavior

Bootstrap/reset share the validator; reset hashes with bcrypt cost 12, audits without secrets, closes its pool and updates only an existing normalized username. Limiter increments failures, clears on success and expires with integer `Retry-After`.

## Testimonial safety

Unchanged from V12A; production testimonial validation continued to pass regression.

## Mobile viewport results

Auth E2E at 390×844 confirmed readable countdown, disabled/re-enabled submit and field preservation.

## Desktop preservation

Desktop Login and strict-port local behavior were preserved.

## Documentation consistency

Auth, deployment, env and security docs match the implemented defaults and operational flows.

## Visual-reference consistency

Rate-limit evidence is `.agent-reports/v1-2-admin/login-rate-limit-390x844.png` and was captured from the running app.

## Package hygiene

No real credential was added; password/hash audit and browser-storage assertions passed. Final archive scanning remains a V12E gate.

## Remaining blockers

None for V12C. The documented single-process limiter is a known limitation, not an unresolved acceptance failure.

## Final verdict

PASS
