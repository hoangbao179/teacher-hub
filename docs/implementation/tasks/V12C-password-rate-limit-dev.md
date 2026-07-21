# V12C — Password, rate limit and development UX

## Goal

Thống nhất mật khẩu tối thiểu 6 ký tự, bổ sung reset password an toàn, limiter có cấu hình và countdown Retry-After rõ ràng.

## Scope

- Central password policy shared by bootstrap and password reset.
- Interactive `npm run admin:reset-password` plus safe environment automation.
- Audit `ADMIN_PASSWORD_RESET` and limiter-clear hook when available in-process.
- Environment-dependent limiter defaults with startup validation.
- Client Retry-After parsing/countdown and accessible blocked state.
- Strict Vite port 5173 and environment/development documentation.
- Unit, integration and E2E coverage.

## Out of scope

Password-reset email, raw password storage/logging, unauthenticated production reset endpoint, Redis implementation.

## Verification gate

`npm run check:fast`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, then V12C verification report.
