# PDF v2 readiness diagnostics

## Task level

Initial and final: Level 3 (production deployment gate and sensitive diagnostics).

## Problem

Production readiness run `40557387507` reached the verifier after auth/setup but
returned only `PDF_V2_CLOUD_READ_BLOCKED`. Its original failure cannot be recovered
from that log, so it does not prove an IAM, revision or configuration problem.

## Root cause

The top-level catch replaced every non-gate exception, including gcloud process
errors and JSON parse errors, with one permissions-oriented message. Reads had no
operation context. This hid both the failed resource and the failure category.

## Decision

Use fixed, locally constructed diagnostics per read; classify upstream text only
in memory and never echo it. Emit only allowlisted reason/permission/signal and
bounded numeric exit status. Keep unknown failures explicit as `COMMAND_FAILED`
with step/status rather than assuming verifier permissions. No new dependency,
compiler, cloud service or production resource cost is introduced.

## Changes

Read failures identify Worker/Gateway service, pinned revision, IAM policy or
Queue. JSON failures are separate from command failures. Worker/Gateway validation
retains its gate code and adds service context. CLI failure emits no PASS JSON.
All pins, IAM/traffic/resource/env/queue checks remain in force.

Comparison with the accepted operations contract confirms legacy staging uses
max 3 / 32 MiB Worker scratch / 30s Gateway / no chunk flag, while v2 requires
max 1 / 384 MiB / >=180s / chunk flags. These intentionally separate contracts
remain unchanged; a source comment and operations comparison prevent accidental
reuse of legacy staging as a v2 deployment tool.

## Verification

Targeted Node tests exercise all seven failing reads, invalid JSON, common gcloud
failure categories, safe output with credential/payload/injection fixtures,
successful evidence, source validation and unchanged security/resource gates.
Existing staging/public-HMAC and readiness dispatch tests cover adjacent tools.
Deployment shell tests use command fakes, including rollback and preservation of
active v2 jobs; no actual cloud/VPS mutation or database operation is performed.

- `node --test scripts/pdf-v2-readiness.test.mjs scripts/pdf-cloud-stage.test.mjs scripts/pdf-cloud-stage-public-hmac.test.mjs scripts/dispatch-pdf-v2-readiness.test.cjs`: 71 passed.
- `node --check scripts/pdf-v2-readiness.mjs`: passed.
- `bash scripts/pdf-v2-deploy.test.sh` and `bash scripts/pdf-v2-deploy-flow.test.sh`
  (Git Bash): passed, including all eight deployment scenarios.
- `npm run check:repo` and `npm run check:docs`: passed.

Workspace typecheck/lint, full regression, cloud reads and Drive E2E are not run:
the executable diff is limited to the standalone Node deployment adapter. Its
mocked read/CLI boundary and existing deployment orchestration tests isolate the
risk without starting unrelated application/database/browser infrastructure.

## Documentation updated

The long-document operations runbook documents diagnostic interpretation and the
legacy/v2 configuration comparison. The legacy staging header points to it.
No product/API/architecture contract changes are required.

## Rollback

Revert this commit to restore the prior diagnostic behavior. No migration, data
backfill, IAM/Cloud Run change or environment update requires rollback. Readiness
must remain mandatory during rollback.

## Remaining risks

Unknown gcloud wording remains `COMMAND_FAILED` with step/status; raw text is
intentionally withheld. The original production blocker and live v2 readiness
remain unverified until the normal pipeline executes the new script. No real
Drive E2E or cloud capacity certification is claimed.
