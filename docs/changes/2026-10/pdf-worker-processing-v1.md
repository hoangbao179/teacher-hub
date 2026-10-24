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
Original implementation local results (before the CI correction below):

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
and canonical current implementation status. WIF/production deployment is unchanged;
only the documented subject is corrected to the supplied numeric-ID form.

## CI runtime prerequisite and error-classification correction

The initial PR's Fast quality gate ran native Linux worker tests without installing
qpdf/util-linux. The Docker image included both, so Docker tests passed while the
Ubuntu runner's E2E persisted FAILED instead of COMPLETED. The original log did
not capture a result error code or parser stderr. A controlled Linux reproduction
with only prlimit in PATH confirms the missing-qpdf path: exit 127, stderr
`prlimit: failed to execute qpdf: No such file or directory`, incorrectly classified
as permanent INVALID_PDF. A missing prlimit itself already yielded Node ENOENT.
The launcher can also report exit 1/126 across failure modes; qpdf's documented
document outcomes use 0/2/3.

Fast quality gate now installs qpdf/util-linux, checks executables and versions,
and installs standalone worker dev dependencies from their lockfile. Only this
job's dependency setup/cache changes; all four gates and deployment conditions
remain intact. Parser launch failures (ENOENT/EACCES or 1/126/127) now yield
retryable SERVICE_UNAVAILABLE, while corrupt/warning PDFs still fail strict checks.

The regression runs in isolated child processes with an empty PATH, then a PATH
containing only prlimit, without changing the parent environment. It failed on
the original image with INVALID_PDF and reports only controlled fixture stderr.
E2E also probes required executables and includes sanitized terminal-result metadata
on assertion failure. No document stderr is logged in production. Worker contract,
security limits, Linux E2E expectations and feature gates are unchanged.

Correction verification: standalone worker typecheck PASS; Windows 17 tests PASS
with two Linux-only tests skipped; Linux Docker 19/19 PASS with zero skips,
including the missing-executable regression and original E2E. WIF validator six
tests PASS, mocked deployment guards PASS, repository/docs checks PASS. GitHub's
four required checks must independently confirm the pushed correction; local
results alone do not establish PR merge readiness. This correction remains Level 3
because it changes CI runtime setup and infrastructure-error handling. Rollback
is reverting the correction commit; no cloud or production state is modified.

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
