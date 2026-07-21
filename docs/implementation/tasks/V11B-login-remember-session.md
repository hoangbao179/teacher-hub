# V11B — Login and remember session

## Goal

Provide a welcoming mobile-first Cô Vy login while making session persistence an explicit, secure choice.

## Scope

- Add Homepage return action, shared branding, semantic fields, password visibility, friendly errors and keyboard-safe layout.
- Add centralized auth storage with deterministic token lookup and separate local/session persistence.
- Remember only the selected email and preference; never persist the raw password.
- Preserve `/api/auth/me` bootstrap, 401 logout, protected destination forwarding and guest-only login redirect.
- Add deterministic storage checks and Playwright coverage.

## Out of scope

No password reset, raw-password storage, refresh-token system, backend auth redesign or client-readable auth cookies.

## Verification gate

`npm run check:fast`, `npm run test:e2e` and `npm run build` must pass, including storage and authenticated-login-route acceptance.
