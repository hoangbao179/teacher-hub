# Cloud Run PDF worker foundation

## Task level

Initial Level 3; final Level 3: isolated deployment workflow, WIF/IAM boundary and
runtime configuration. No database, migration or existing financial behavior changes.

## Problem

The PDF PoC permits a further external experiment, while the shared production
VPS/API budget cannot host the browser pipeline. Cloud account/resource names alone
do not establish a deployable or secure service.

## Decision

Prepare a dependency-free health-only container and a separate manually dispatched
workflow. Default to WIF verification; require main, exact target validation,
explicit deployment mode/confirmation and a GitHub environment. Environment reviewer
rules and WIF claim restrictions must be configured outside source before dispatch.
Cloud Run IAM protects the endpoint; the container itself has no public JWT layer.

This is deliberately not a deployment approval or a port of the browser PoC. The
requested 1 CPU/2 GiB/concurrency 1 allocation is configuration, not a measured
PDF capacity. Bucket/queue/runtime data privileges are deferred until a separate
handler, retention and security design is reviewed.

## Changes

Worker health listener, non-root allowlisted Docker build, HTTP regression tests,
main-only manual workflow with WIF and no JSON key, guarded deployment script and
offline orchestration tests. Deploy builds/smokes before push, resolves the image
digest, sets service/revision scaling and enforces authenticated access. Existing
VPS workflow, API, client, shared contracts and PoC implementation remain unchanged.

## Verification

- Worker syntax check and two Node tests passed (real local HTTP listener, health,
  HEAD, unsupported method/job/PDF routes, invalid PORT).
- Bash syntax and offline deployment tests passed: nine guards reject before any
  cloud command; public/allAuthenticatedUsers IAM, list/build/smoke/digest failures
  prevent deployment; disabled IAM postcheck fails; success uses intended flags.
- actionlint 1.7.12 passed for the new workflow, with ShellCheck disabled; downloaded
  official binary verified against release checksum. Bash syntax/mocks cover scripts.
- Repository consistency, Markdown links and diff whitespace checks passed.
- Linux container build/smoke not run: local Docker Desktop Linux engine pipe is
  unavailable. The workflow includes this gate before pushing/deploying.
- WIF exchange, IAM inventory, image push and cloud deployment not run, as required.
  No cloud credentials or resource state were inspected. No live authenticated
  invocation is claimed. Full application/database/E2E suites were not run because
  the isolated worker changes no existing runtime or cross-workspace contract.

## Documentation updated

Operations runbook is the source for IAM prerequisites, WIF test procedure, approval
gates, costs/retention and rollback. Production/deployment architecture and PoC link
to it; canonical implementation status marks the worker as developing.

## Rollback

Preparation has no cloud/data state to restore. Revert the foundation commit if
needed. After a future deployment, retain previous revision/digest/config/IAM and
use the reviewed operator rollback procedure in the runbook. First deployment has
no previous revision; service deletion requires separate owner approval.

## Remaining risks

Real IAM/WIF/environment protection, Linux image execution, Cloud Run settings,
anonymous denial/authorized health, quotas and billing remain unverified. Deployer
Run Admin scope and image retention require approval. GitHub merge to main can
trigger the existing VPS deployment workflow even though the worker workflow is
manual. No rendering, large-document stability, production print quality or cost
estimate is established by these targeted checks.
