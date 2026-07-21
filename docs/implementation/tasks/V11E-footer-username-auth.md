# V11E — Homepage footer and username authentication

## Goal

Apply the requested Cô Vy footer/login copy and allow the single teacher admin
to authenticate with a configured username and password instead of requiring an
email address.

## Scope

- Remove only the footer admin-login link, preserve the header “Quản trị” link,
  and replace the copyright footer with the requested 2026 fan dedication and heart.
- Change the login section heading to “Đăng nhập”.
- Add a forward-only users migration for a unique username and optional legacy email.
- Change shared/OpenAPI/client/server auth contracts from email to username.
- Configure bootstrap admin with the fixed username `covy` and a password secret.
- Preserve password hashing, login rate limiting, remember-session semantics and
  backend-authoritative `/me` bootstrap.
- Update auth E2E, package rules, environment examples and operator documentation.

## Out of scope

No self-registration, password reset, multi-user management, email delivery,
business-domain change or independent full-system review.

## Verification gate

Build shared/server/client, run auth/public E2E plus full repository verification,
apply migrations safely, bootstrap/login with username, inspect mobile/desktop UI,
update reports and require PASS before completion.
