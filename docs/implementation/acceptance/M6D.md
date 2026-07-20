# M6D Acceptance

- [x] Startup validates all required server variables and production rejects weak
  JWT/database configuration without logging secrets.
- [x] Password/JWT/auth/CORS/headers/body-limit/SQL/error/rate-limit/audit controls
  are verified and residual limitations documented.
- [x] Correlation IDs, structured sanitized logs, health/readiness, startup failure,
  graceful shutdown and pool shutdown are implemented or verified.
- [x] Forward-only migration, backup, restore, retention, rollback, timezone and
  utf8mb4 procedures are documented with non-destructive scripts.
- [x] Docker deployment uses Node 24 production stages, non-root runtime, health
  checks, restart policies, persistent MySQL and reverse-proxy/static caching.
- [x] Node 24 CI runs clean install and full MySQL-backed checks with failure artifacts.
- [x] Dependency tree, production audit, licenses and unused dependencies are reviewed
  without forced or unrelated upgrades; every finding is classified.
- [x] Required README, deployment, security, teacher-guide, checklist, limitation and
  post-V1 documents are complete and consistent.
- [x] Dev seed is idempotent/non-production, fictional and isolated from deterministic tests.
- [x] Required root build/test/database/backup/restore scripts exist and are documented.
- [x] Release checklist records environment-specific items without claiming production approval.
- [x] `npm ci` and `npm run check:full` pass on Node 24 with native MySQL.
- [x] Docker verification is completed where available or recorded as an accepted
  environmental limitation with read-only availability evidence.
- [x] Final M6D report ends in PASS before `RELEASE_CANDIDATE_READY` is recorded.
