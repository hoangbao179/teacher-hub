# PDF Cloud activation — Phase 4 readiness gate

## Task level
Level 3: security-sensitive Cloud Run/Cloud Tasks/GCS identity and deployment operations. This phase is **read-only preparation**; no IAM grants, Worker deploy, PDF activation or VPS change was made.

## Problem
The public PDF Tool UI and transactional job API have merged and deployed, but the API and independent recovery CLI still construct \`DisabledPdfProvider\`. Cloud Run has only previously reported health-only deployment. There is no approved identity for the external VPS to issue Cloud Tasks requests.

## Root cause
The producer identity ADR is proposed. The external VPS cannot use the GitHub verifier WIF as its identity, and no independently attested VPS issuer or reviewed broker has been approved. The active Cloud Run revision's processing IAM/mount/queue/bucket configuration is not independently verified.

## Decision
Add an **operator-only, read-only** preflight inventory rather than weaken the default-disabled runtime. Implement deterministic validation of Cloud Run service/revision, private IAM bindings, immutable image, bounded memory volume, processing flags, Cloud Tasks queue retry/rate policy, and private bucket. Do not acquire cloud tokens in application code, create Google tasks, read user files, issue IAM changes or deploy.

## Changes
- \`scripts/pdf-cloud-readiness.mjs\`: offline JSON snapshot mode and fixed \`gcloud\` describe/get-iam-policy commands.
- \`scripts/pdf-cloud-readiness.test.mjs\`: fixtures for missing evidence, public invoker, mutable image, unbounded volume and drifted queue policies.
- CI invokes \`npm run check:pdf-cloud-readiness\` before the existing repository quality gate.

## Operator usage
On a trusted workstation with an authorized, **read-only** gcloud identity:

\`\`\`bash
node scripts/pdf-cloud-readiness.mjs --gcloud
\`\`\`

For synthetic/offline verification only:

\`\`\`bash
node scripts/pdf-cloud-readiness.mjs --snapshot /path/to/operator-snapshot.json
\`\`\`

The output omits raw IAM policy bindings. Do **not** paste production policy JSON, access tokens or secrets into issues/PRs. This is an inventory, **not** a production activation approval. Non-zero exit denotes missing/incorrect resource evidence; exit zero still means producer identity and real E2E remain BLOCKED. Do not run it in CI with production credentials; CI runs fixtures only.

## Verification
Unit preflight fixtures run under Node's built-in test runner and in CI. GitHub gates must be checked on this branch head before reviewing. This task did not execute real \`gcloud\` or local/production Docker. No real cloud PDF E2E, scheduler probe, VPS benchmark, token exchange or cost verification was performed.

## Rollback
Revert this standalone script/test/docs and the CI test command; no schema or production resource change. No cloud state or user data exists to roll back from this change.

## Remaining risks / next decision
Before real activation, explicitly approve an identity approach (OIDC issuer attesting VPS, or a narrowly scoped authenticated broker/producer). Record operational issuance/rotation/revocation, minimal producer IAM, queue and private Worker invocation design; verify the live Worker config, Cloud Tasks queue, GCS bucket and IAM. Then implement identity injection consistently in HTTP and reconcile CLI, enable independent scheduled reconciliation, perform private live E2E including cross-device download. Only after that and owner approval may the production feature flag be enabled. A live environment might have different gcloud export shapes; investigate any failed inventory checks before allowing activation. Existing VPS Docker constraints stay unchanged.

## Phase 4 extension: simple HMAC Gateway (not activated)

The owner approved continuing source work using a lightweight Gateway rather than deploying a custom VPS certificate authority. Code now includes a Cloud Run gateway allowlisting fixed Cloud Tasks and GCS operations, an HMAC GatewayPdfProvider, a fail-closed approved runtime injection path, an image definition, and synthetic attack/contract checks. HTTP and CLI still instantiate the disabled runtime with no approval argument. No secrets, IAM grants or production deployments were written by these commits.

**Residual risks:** The shared HMAC secret is not attested identity; nonce replay cache is local to each instance and loses state on restart; HTTP requests and real task dispatch were not cloud-tested. Before activation, complete replay hardening, rate limiting, secret rotation, IAM review, identity bootstrap for HTTP/CLI, scheduled recovery, actual-worker processing deployment and cross-device PDF E2E. Roll back by reverting Gateway-only commits and stopping any future approved gateway deployment; existing private Worker and queue stay untouched.

See docs/operations/pdf-gateway.md for contract and review gates.

## Post-audit remediation (source only)

Addressed initial Codex P1/P2 findings in feature branch: pipeline-based cancelable Gateway response streaming, atomic cross-instance GCS nonce reservation with fail-closed behavior, explicit TASK_ALREADY_EXISTS signaling for Cloud Tasks 409, per-instance admission budgets/one stream, fail-closed revision/traffic/resource/direct-invoker preflight, and shared file-only Gateway bootstrap for public API, admin API, and recovery CLI. Added focused tests for bootstrap config, provider 409, shared nonce reservations and gateway request limits. Production IAM, effective inherited permissions, Cloud Run processing revision, secret provisioning/rotation, scheduled recovery, PDF E2E and budget approval remain operator-only prerequisites and were not changed. No deployment or enablement occurred. The revised implementation requires CI verification and one final independent Codex audit before recommending merge; never equate offline tests with production readiness.
