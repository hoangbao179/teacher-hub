# PDF worker deployment hardening

## Task level
Initial and final Level 3: deployment and IAM security boundary.

## Problem / Root cause
Baseline 684043b scripts/deploy-pdf-worker.sh:77 used --no-allow-unauthenticated,
requesting IAM writes not available to Run Developer. Invoker checking was only
verified after deployment. .github/workflows/pdf-worker.yml:30 declared an environment
without verifying approval protections. CI quality omitted the worker regressions.

## Decision / Changes
Preserve existing private-service IAM; operator bootstraps and configures IAM separately.
Pre/post checks reject disabled checking, public bindings and permission errors. Missing
service fails before build. No Run Admin escalation. Environment reviewer/main-only
protection is checked before WIF; API errors fail closed. Existing quality includes
worker tests; no existing gate removed. Environment validation is extracted into a tested CommonJS helper; worker job receives actions:read, required by both GitHub endpoints. Missing response fields fail closed. Runbook includes first bootstrap with operator identity, immutable digest and private-service verification. Added shutdown and IAM/deploy failure coverage.

## Verification
Node syntax and 3 real process/HTTP tests passed; shutdown emits SIGTERM inside child
for Windows compatibility (not proof of Linux OS signal delivery). Bash deployment
regressions passed using mocked gcloud/docker. actionlint passed with ShellCheck disabled.
Three environment regression tests also passed (safe fixture, API errors, unsafe/malformed responses); these mock GitHub API and do not establish live permissions.
No cloud credentials, IAM inspection, WIF exchange, workflow dispatch or container build.
Full app regression unnecessary: isolated worker and additive quality steps only.

## Documentation updated
Operations runbook and canonical implementation status updated with operator bootstrap,
least privilege and environment/branch protection requirements.

## Rollback
Revert this commit for source rollback only; do not run the old IAM-writing deployment
with Run Developer. No cloud/data state changed. Existing runbook governs future rollback.

## Remaining risks
verify-wif and health deployment are NOT READY pending live provider/environment/IAM
verification. Environment metadata access may be denied; workflow deliberately blocks.
Inherited public IAM must be reviewed by operator; service policy alone cannot prove
absence of ancestor grants. Concurrent operator IAM changes remain outside workflow lock.
CLI flags match current reference, but live CLI/API and Linux image execution are untested.
Do not replace unavailable environment approval with a typed confirmation; use approved
operator deployment with credentials unavailable to GitHub or a supporting GitHub plan.
