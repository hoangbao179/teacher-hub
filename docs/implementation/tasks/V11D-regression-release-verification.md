# V11D — Regression and release verification

## Goal

Prove the branding, login and navigation changes preserve V1 business workflows and produce a coherent, clean release artifact.

## Scope

- Synchronize public configuration, metadata, documentation, seed content and tests.
- Reject known mandatory public placeholders in production.
- Run the complete public/auth/admin/business regression suite.
- Add a deterministic source scan proving the application never persists raw passwords.
- Update teacher/deployment guidance.
- Run clean source packaging, package inspection and final viewport captures.

## Out of scope

No independent full-system review, deployment, dependency upgrade, schema change or business-rule modification.

## Verification gate

`npm ci`, `npm run check:full`, `npm run package:source`, `npm run check:package`, repository status/diff review and Docker build when available. Required documentation and final screenshots must be complete.
