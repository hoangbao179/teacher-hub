# V12E — Regression and release

## Goal

Chứng minh V1.2 không làm thoái lui Homepage, authentication, admin operations, core domain or package hygiene.

## Scope

- Full functional, mobile, desktop and security regression.
- Controlled source package and checksum validation.
- `npm ci`, `npm run check:full`, package commands, git evidence and Docker build where available.
- Final review artifacts under `.agent-reports/v1-2-final/`.

## Exit rule

Do not start the independent full-system review. V12E is PASS only when every required command and visual/manual gate passes.
