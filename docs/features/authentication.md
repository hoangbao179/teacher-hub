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
