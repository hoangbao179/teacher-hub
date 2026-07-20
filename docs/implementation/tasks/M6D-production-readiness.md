# M6D — Production readiness and release-candidate preparation

## Goal

Prepare a secure, documented and reproducible V1 release candidate for the
separate full-system review; this checkpoint does not grant production approval.

## Scope

- Validate server runtime environment and reject unsafe production configuration.
- Harden login, request tracing/logging, error handling, health/readiness and shutdown.
- Document and script safe migration, backup, restore and rollback operations.
- Review production Docker Compose, Node 24 images, non-root runtimes and health checks.
- Update Node 24 CI with MySQL-backed verification and failure artifacts.
- Audit dependency validity, production vulnerabilities, licenses and unused packages.
- Complete operator/deployment/security/troubleshooting and teacher documentation.
- Confirm seed isolation, root release scripts and the release-candidate checklist.

## Exclusions

- Architecture redesign, broad dependency upgrades, refresh tokens, destructive
  production automation and any features outside V1.

## Required verification

```bash
npm ci
npm run check:full
```

Docker commands are required only where Docker is available. The final marker may
only be `RELEASE_CANDIDATE_READY` or `RELEASE_CANDIDATE_BLOCKED`.
