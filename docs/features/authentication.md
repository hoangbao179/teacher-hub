# Authentication and remembered sessions

`/admin/login` is the only teacher login. Authentication remains backend-authoritative:
after finding a token, the client calls `/api/auth/me` before rendering protected routes.
An authenticated visit to `/admin/login` redirects to `/admin`.

The checkbox **Ghi nhớ đăng nhập trên thiết bị này** controls client persistence:

- selected: the JWT and username are stored in `localStorage` for the configured JWT lifetime;
- not selected: the JWT is stored in `sessionStorage`, and the username is not retained;
- logout and an invalid/expired token clear the JWT from both stores;
- token lookup is deterministic: `localStorage` first, then `sessionStorage`.

The application never persists the raw password. Browser password saving, when offered,
is owned by the browser password manager. The remember option should be cleared on a
shared device. V1 has no refresh-token or centralized token-revocation service.

The single teacher account is provisioned with `BOOTSTRAP_ADMIN_USERNAME` and
`BOOTSTRAP_ADMIN_PASSWORD`; email is not required for login or bootstrap. Usernames
are case-insensitive and may contain `a-z`, `0-9`, `.`, `_` and `-`.
Bootstrap updates the matching account; when exactly one legacy account exists it
renames that account instead of creating a second admin. It refuses to guess when
multiple unmatched users exist.

Password policy is centralized through `ADMIN_PASSWORD_MIN_LENGTH`; V1 defaults
to an intentionally minimal 6 characters for bootstrap and reset. Changing an
environment value does not mutate the database: run `npm run db:bootstrap-admin`
to apply bootstrap credentials, or `npm run admin:reset-password` to update an
existing admin with hidden confirmation, bcrypt hashing and an
`ADMIN_PASSWORD_RESET` audit event. Raw passwords are never written to storage,
logs or audit data.

Login failures are limited per current client-IP/normalized-username key. Defaults
are 60 seconds/20 failures outside production and 300 seconds/10 failures in
production; both are configurable with validated `LOGIN_RATE_LIMIT_*` values.
The API returns `Retry-After` on HTTP 429 and the login form shows an accessible
countdown while preserving input. A successful login clears its key. The current
store is process-local memory, so restart clears development state and future
multi-instance production deployment requires a shared store such as Redis.
While blocked, submit is disabled and the live-region message counts down in
seconds before re-enabling automatically. If `Retry-After` is unavailable, the
client uses a finite friendly fallback rather than an indefinite wait message.
