# V11B Implementation Report

## Initial repository state

The V1.1 task began from a clean working tree. V11B began only after the recorded
V11A PASS; the working tree then contained only the cumulative V1.1 changes and
pre-created checkpoint documents. No migration was pending or modified.

## Scope completed

Completed the welcoming Cô Vy login, centralized local/session auth storage,
backend-authoritative bootstrap, guest-only login route, friendly errors,
documentation, responsive screenshots and Playwright coverage required by V11B.

## Files changed

- Login/auth: `client/src/pages/LoginPage.tsx`, `client/src/auth/AuthContext.tsx`,
  `client/src/auth/authStorage.ts`, `client/src/api/client.ts`, `client/src/App.tsx`.
- Tests: `client/scripts/auth-session.e2e.mjs`, related login selectors in the
  existing E2E/capture scripts, and `client/package.json`.
- Docs: authentication feature, security/limitations, acceptance, status and reports.

## Migrations added

None.

## API and contract changes

None. Existing `/api/auth/login`, `/api/auth/me` and `/api/auth/logout` remain
authoritative. The backend intentionally keeps inactive-account and bad-credential
responses indistinguishable; the UI maps all supported safe error codes without
showing raw server detail.

## Login changes

The mobile-first screen now has Cô Vy English branding, Homepage back action,
educational icon, restrained pastel background, semantic autocomplete, accessible
show/hide password, Enter submission, loading state, privacy guidance, safe-area
padding and scrollable `100svh` behavior.

## Auth-storage changes

One module owns token and remembered-email storage. Remembered sessions use
localStorage; session-only login uses sessionStorage. Lookup is local then session.
Saving or clearing a token removes both old copies first. Logout and invalid/expired
bootstrap clear both stores, while explicitly remembered email remains after logout.

## Business rules affected

None. Lesson, tuition, enrollment and schedule behavior is unchanged.

## Tests added

Playwright covers Homepage return, password visibility, semantic fields, Enter and
friendly invalid-credential handling, both persistence modes, email behavior,
logout clearing, invalid-token bootstrap, `/api/auth/me`, authenticated-login
redirect, fresh browsing-session behavior, absence of raw password from browser
storage/cookies, 360px overflow and short keyboard-like viewport scrolling.

## Commands executed

- `npm -w client run typecheck` (PASS)
- `npm -w client run lint` (final PASS; first run identified two local lint issues that were fixed)
- `node client/scripts/auth-session.e2e.mjs` (final PASS after tightening test selectors/scroll assertion)
- `npm run check:fast` (PASS)
- `npm run test:e2e` (final PASS; first full run found legacy password selectors, then all were updated)
- `npm run build` (PASS)
- `git diff --check` (PASS)
- UTF-8 mojibake scan (only the literal diagnostic pattern in `AGENTS.md` matched)

## Test results

All required V11B gates pass. The full E2E chain passed Homepage, authentication,
browser smoke, lesson wizard, tuition management and schedule operations.

## Manual UI verification

Inspected `.agent-reports/v1-1-login-final/login-360x800-final.png` and
`login-390x844-final.png`. Both are readable, balanced and free of horizontal
overflow. The 360px guidance wraps normally; fields and submit remain touch-friendly.

## Known gaps

V1 still uses expiring JWTs in Web Storage without refresh-token rotation or
centralized revocation. This is documented and unchanged from the approved V1
architecture. Browser password saving remains the browser password manager's job.

## Current git status

The working tree contains cumulative scoped V11A/V11B source, docs, tests and image
assets. No unrelated pre-existing changes or migrations are present.
