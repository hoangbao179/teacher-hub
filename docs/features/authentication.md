# Authentication and remembered sessions

`/admin/login` is the only teacher login. Authentication remains backend-authoritative:
after finding a token, the client calls `/api/auth/me` before rendering protected routes.
An authenticated visit to `/admin/login` redirects to `/admin`.

The checkbox **Ghi nhớ đăng nhập trên thiết bị này** controls client persistence:

- selected: the JWT and email are stored in `localStorage` for the configured JWT lifetime;
- not selected: the JWT is stored in `sessionStorage`, and the email is not retained;
- logout and an invalid/expired token clear the JWT from both stores;
- token lookup is deterministic: `localStorage` first, then `sessionStorage`.

The application never persists the raw password. Browser password saving, when offered,
is owned by the browser password manager. The remember option should be cleared on a
shared device. V1 has no refresh-token or centralized token-revocation service.
