# PDF batches, durable dispatch and authenticated downloads

## Task level

Initial and final Level 3: additive database migration, authorization, cross-service
producer and download boundary. PR #5 was merged before branching from origin/main;
the Worker v1 contract is unchanged. No UI, cloud, VPS or CI deployment change.

## Problem and decision

Teachers need persisted batch/job history and authorized result access without
running PDF processing on the small VPS. Production currently has no independently
verified VPS identity for Google Cloud. Implement local orchestration and inert
production transport rather than importing personal credentials or opening worker
access. The [identity ADR](../../decisions/ADR-pdf-producer-identity.md) records
federation/broker alternatives, trust/cost boundaries and outstanding approval.

## Changes

Migration 0027 adds batches, jobs/outbox and short-lived ticket hashes. Owner locks
serialize caps/idempotency; all cloud I/O runs outside transactions. UUID leases
and next-action timestamps support recovery across processes/restarts. Task creation
uses deterministic names; a timeout cannot allocate another UUID. Manual retries
create explicit successor attempts because Worker terminal objects are immutable.

Reconciliation validates Worker claim/source hash, exact 24-hour TTL, job ID,
timestamps, enum, output path and size/pages/checksum. Queue deletion is ambiguous;
overdue jobs become RESULT_UNCONFIRMED instead of falsely claiming PDF failure.
Positive exhausted-attempt evidence uses count/time/failed response with no active
attempt. Cloud errors are tracked separately and late results remain pollable.

Authenticated streaming uses one-time hashed tickets <=120 seconds, clipped to
job expiry. Only owner COMPLETED jobs can download. Single concurrent stream,
backpressure, byte/deadline bounds and attachment/nosniff avoid whole-file buffering.
No GCS signer, public URL, raw source URL or PDF storage on the VPS is introduced.

## Verification

Worker compatibility uses the actual Worker parser in a child Node process.
Targeted MySQL integration applies all migrations, including interrupted migration
recovery, and tests atomic rollback/idempotent creation, timeout/duplicate dispatch,
durable result validation, cloud errors, missing/exhausted tasks, retries, expiry,
auth/ownership, one-use/expired tickets and stream bounds. The isolated local Docker
MySQL container contains synthetic data only. Runtime factory remains disabled even
with PDF_API_ENABLED=true; no cloud credentials or remote calls are used in tests.

Local verification results: `npm run check:ci` PASS (workspace builds, typechecks,
client lint, unit suites and repo/docs guards); complete MySQL integration 86/86
PASS with zero skips after migration/recovery. Final targeted PDF unit suite 6/6
PASS, final PDF MySQL HTTP/orchestration scenario PASS, and server typecheck PASS
after the final queue-schema/lease/download-boundary regressions. GitHub's four
required checks are verified separately for the pushed commit. Real cloud E2E, issuer/
federation setup, production performance and live IAM/queue config remain unverified.
One local setup attempt failed because the test account lacked trigger permission
required by existing migration recovery; only the disposable test instance's
synthetic account was adjusted, and the complete migration/integration run passed.

## Documentation updated

Shared contracts/OpenAPI, PDF API feature, proposed identity ADR, API operations,
worker runbook link and canonical implementation status. Task 3 has a concrete
contract and unavailable-state behavior; production download/submission are blocked
on identity approval/wiring and private E2E, not frontend completion alone.

## Rollback

Keep production disabled and roll back code first. Additive tables can remain
unused by old code; preserve all history and enqueue intentions. No automatic drop
or data deletion. Future migration rollout needs approved backup/recovery and disk
headroom; interrupted create-if-absent DDL must be inspected/recovered forward.
See [operations](../../operations/pdf-job-api.md). No deployment occurred here.

## Remaining risks

Identity acquisition/wiring and automated production scheduling are intentionally
unimplemented pending review. REST and fake adapter verification cannot establish
real cloud interoperability. Missing results cannot always distinguish exhaustion
from successful task deletion; RESULT_UNCONFIRMED preserves that uncertainty.
History/indexes/backups grow on the shared 15 GB disk; there is no approved business
data purge. RAM/CPU production capacity and usage-dependent cloud costs are estimates
only. qpdf validation is not malware sanitization; attachment handling remains required.
