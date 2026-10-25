# Private PDF Gateway integration on the existing VPS

## Task level

Initial and final: Level 3 (identity, deployment and recovery). No migration,
classroom/financial rule change, Cloud Run redeploy or production activation.

## Problem and root cause

Cloud Tasks/Worker and Gateway HMAC were reported working by the operator, but
the API Gateway provider sent no Google ID token, so private Cloud Run IAM would
reject it. Deployment Compose supplied neither PDF configuration nor an API
egress network; independent recovery had a CLI but no host scheduler template.
The staging helper compared raw traffic JSON, incorrectly treating metadata/order
changes after no-traffic staging as routing drift.

## Decision and changes

Use the existing Gateway and its HMAC protocol with a separate, short-lived
Google ID token from explicit OIDC federation. The issuer must already attest
the VPS; no issuer is currently confirmed. No ADC/key discovery or HMAC-only
fallback is allowed. Identity/configuration errors remain fail-closed. A dedicated
caller requires only Gateway invoker permission and subject-scoped federation.

Keep PDF configuration host-owned in a read-only directory, excluded from Git,
images and source packages. Actions copies scheduler templates without transmitting
PDF secrets or enabling the feature. Compose adds API outbound connectivity but
keeps MySQL internal and existing resource caps. A systemd timer runs the existing
bounded CLI each minute inside API, with a host lock, 64 MiB heap cap and sanitized
unavailable failure when enabled. No additional container is introduced.

Traffic comparison uses resolved revision/percent/tag/URL, ignoring latestRevision
metadata and array/property order while rejecting invalid totals or routing drift.
Existing PDF migrations `0027`/`0028` cover the required schema unchanged.

## Verification

- `npm run check:ci`: PASS locally (typecheck, lint, unit suites, builds, guards).
- Identity/bootstrap/provider regression: 6 PASS (STS/IAM audiences, refresh,
  secret-safe errors, bad token/config and mandatory IAM + HMAC).
- Staging regression: 7 PASS; VPS configuration regression: 2 PASS.
- PDF MySQL integration: 4 PASS on a disposable MySQL container/database, including
  migrations/recovery, outbox, public/private ownership and bounded download.
- Public PDF browser E2E: PASS with FakeCloud and MySQL: two contexts,
  browser closure/recovery, retry, expiry, ticket replay and mobile layout.
- Deployment env shell regression and recovery shell syntax: PASS.
- Both Compose files validate with synthetic environment values; compiled recovery
  CLI exits 1 when enabled without approved identity and exits 0 when disabled.
- Real VPS/cloud website E2E, physical second device, elapsed 24 hours, issuer
  renewal and systemd execution on Ubuntu: NOT RUN; missing VPS issuer and no
  production activation authorized before security/recovery verification.

## Documentation updated

Current status distinguishes operator-reported cloud success from unverified VPS
activation. Identity ADR, API feature, deployment architecture and operations link
to [the activation runbook](../../operations/pdf-vps-activation.md), which specifies
least privilege, host ownership, rehearsal gates, deployment and rollback.

## Rollback

Set host `PDF_API_ENABLED=false`, recreate API, verify unavailable capabilities,
stop the timer and deploy the previous immutable image SHA. Restore saved Compose
and scripts if needed. Keep MySQL history and GCS results; no down migration.
Image rollback alone does not change host-owned PDF runtime settings.

## Remaining risks

No trusted VPS issuer has been identified; the source implementation does not
create one. IAM bindings and token renewal need operator verification. Recovery
adds a short-lived Node process inside the existing API cgroup; combined memory
and CPU headroom on the 1.5 GB VPS remain unmeasured. Existing local and fake-cloud
checks do not establish end-to-end website readiness or real 24-hour retention.
