# PDF worker processing v1

## Task level

Initial and final: Level 3. The standalone worker adds an external-source security
boundary, GCS persistence, cross-service contract and a Linux runtime dependency.

## Problem and decision

The deployed foundation serves health only. Task 2 needs a bounded and retry-safe
PDF job contract without moving browser rendering onto the resource-constrained
VPS. Direct download preserves original bytes and avoids rasterization cost.
The research pipeline remains separate; no print/download restriction is bypassed.

Use Node-native TypeScript modules, streaming HTTP/GCS adapters and a constrained
qpdf subprocess. Avoid a renderer, GCS SDK retry machinery and runtime npm
dependencies. A fixed metadata-token endpoint is isolated from source downloading.
No arbitrary destination, credentials or source URL enters the request contract.

## Changes and durability

The immutable source claim prevents a repeated UUID from representing another
source. Create-only GCS preconditions protect every object. Output custom metadata
is uploaded atomically with its bytes so a retry can finish result persistence
without fetching again. First terminal result wins across replicas; a losing
successful upload can be an orphan if FAILED won first. It remains private and is
handled by existing bucket cleanup. See the [contract](../../api/pdf-worker-v1.md).

Processing is default-disabled. Production also requires runtime identity,
operator IAM readiness attestation, a writable bounded tmpfs and a live get/create
permission preflight. Insufficient permissions return 503 before source access.
No cloud deployment, IAM update, queue task or VPS change is performed.

## Verification

Targeted TypeScript checks, worker unit/HTTP regressions and Linux Docker fixture
E2E are required. The Docker harness enforces Linux/amd64, one CPU, 2 GiB, no swap,
read-only root, non-root user, no network and 32 MiB temporary filesystem.
Real qpdf checks byte-identical synthetic output; GCS REST tests check multipart
payloads and preconditions separately from the in-memory atomic storage fixture.
Final targeted results:

- `npm --prefix workers/pdf run check`: PASS (strict TypeScript and adapter syntax).
- `npm --prefix workers/pdf test`: 17 PASS, one Linux-only E2E SKIP on Windows;
  that test runs successfully in Docker below.
- `npm --prefix workers/pdf run test:docker`: 18 PASS, zero skips; synthetic
  two-page E2E byte identity, 40-page metadata boundary, 41-page rejection,
  encrypted/corrupt PDF rejection, timeout cleanup and fault/retry cases.
- `node --test scripts/validate-pdf-environment.test.cjs`: six PASS.
- Bash syntax and `scripts/deploy-pdf-worker.test.sh`: PASS using mock cloud/Docker.
- Repository consistency, Markdown links and final diff whitespace checks: PASS.

Linux/amd64 Docker Desktop single final fixture-suite run: wall 1.222 seconds,
cgroup CPU 1.221 seconds, cgroup memory peak 190709760 bytes (181.9 MiB), image
size 81724266 bytes as reported by Docker inspect. These include the test
supervisor, concurrent test processes, fixture servers and real qpdf, not just
one PDF job; memory includes charged cache/kernel allocations. Image size excludes
host/VM, build cache and registry representation. No sustained-load benchmark or
capacity for complex 40-page/10 MiB PDFs is established. Local image only; no push.

A new durability regression initially exposed an unobserved rejection when FAILED
result creation returned a promise through an async cleanup finally block. Awaiting
the write before cleanup now reliably yields retryable HTTP 503; the regression
passes on Windows/Linux. One local Docker export failed because a parent cache
snapshot was missing; rebuilding this image with no cache resolved it without
deleting shared Docker data. The final complete Docker run passed.

Root application/MySQL/browser suites are not run: no client/server/shared source,
VPS deployment or existing application authentication is changed. Worker and
foundation regressions directly cover the isolated runtime/security boundary.

External Drive/cloud E2E is not run: no authorized stable public Drive fixture or
cloud data access is used in this task. Mock storage cannot establish live GCS
IAM correctness. No production capacity claim follows from synthetic test timing.

## Documentation updated

Worker feature/architecture, Worker v1 API contract, Cloud Run runbook, PoC boundary
and canonical current implementation status. Existing WIF/deployment workflow is
unchanged; only the documented subject is corrected to the supplied numeric-ID form.

## Rollback

This task changes source only; deployed health-only service remains intact.
Before future activation, retain the reviewed health-only revision/digest and
configuration. Stop producers, disable processing and restore that revision's
traffic/config if necessary. Preserve private IAM and stored claims/results until
retry windows close. Do not delete data or alter IAM as an automatic rollback.

## Remaining risks

Runtime SA is reported to have Object Creator only; object get remains an operator
prerequisite. Bounded-volume configuration/non-root writability, metadata identity,
real Drive redirects, GCS behavior and Tasks OIDC need cloud verification. qpdf is
a parser, not a malware filter; dependencies/base image need ongoing security
maintenance. Processing 40 pages/10 MiB inside 22 seconds is not established for
arbitrary content. Seven-day lifecycle does not replace 24-hour application expiry.
