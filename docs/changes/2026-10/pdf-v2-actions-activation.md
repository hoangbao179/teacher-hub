# PDF v2 deployment automation

## Task level

Initial and final: Level 3 — production deployment, runtime flags, systemd and
migration verification. No schema migration, IAM or HMAC approval change.

## Problem and root cause

The normal deploy applied migrations and copied recovery units but explicitly
left runtime flag changes and timer installation to an operator. Deploy success
therefore did not enable v2 or prove independent recovery. Existing cloud audits
target older 32 MiB/30-second contracts or no-traffic staging, not the v2 release.

## Decision and changes

Keep the reviewed cloud release and credentials unchanged. Pin its observed
immutable images and require live traffic/resource/IAM/queue verification.
Existing WIF only accepts workflow_dispatch on pdf-worker.yml/main/pdf-worker;
production deploy dispatches that workflow and binds the successful run's
nonsecret evidence to its source SHA and run/attempt, rather than changing IAM.

The locked VPS deploy retains migration/backup machinery, checks real schema and
authenticated candidate capabilities, installs/verifies the existing timer,
updates only three PDF flags and recreates API. Main environment replacement is
moved inside the deployment lock so its snapshot can actually restore old config.
See the [runbook](../../operations/pdf-long-documents.md#automated-production-activation)
for the complete gates, sudo requirements and ongoing release-pin policy.

## Verification

Local `check:ci` passes (typecheck, lint, unit suites, builds, repo/docs guards).
Six targeted PDF/MySQL integration cases pass, including real schema verification
after interrupted 0029 ledger recovery and durable v2 progress. New automation
tests cover pinned cloud drift, dispatch correlation, env preservation/idempotency,
candidate isolation and deployment fault/rollback paths (migration, candidate,
sudo, live API, recovery, active/unknown v2 work). Worker synthetic Linux regression
covers 3/35/50/51/200-page direct input, durable part checkpoints and exact qpdf
page count; those Linux-only cases are skipped on Windows and must pass main CI.
Read-only cloud inventory confirms Worker 00017-guf/Gateway 00013-gej at 100%
traffic and the audit PASS. Production rollout, real Drive E2E and production
timer/schema checks are not inferred from these local results; inspect Actions
and live evidence before claiming deployment success.

## Documentation updated

Operational runbook and implementation current state describe the automation and
distinguish gate success from real-Drive acceptance.

## Rollback

Keep additive 0029/schema/history. Restore old runtime env and application images
if activation fails with no unexpired v2 work/results. If v2 work/results exist
or DB state is unknown, retain compatible API/flags/recovery and fail visibly for
fix-forward. Never downgrade Cloud Run or stop recovery as an automatic rollback.

## Remaining risks

First run may expose missing verifier read permissions or VPS sudo rights; these
are blockers, not permission to modify IAM/security or report success. Public
capabilities and synthetic tests cannot certify real Drive content, print quality,
200-page throughput or actual cloud cost. Permitted fixtures are required.
