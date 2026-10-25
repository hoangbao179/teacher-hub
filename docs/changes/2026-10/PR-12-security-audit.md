# PR #12 — audit Gateway authentication

## Task level

Initial/final: Level 3, authentication and operational security boundary.
Compared `main` at `94b94ccc0be38a9432e336845dd35929fa520e46` with PR head
`7777b163c1492e9584d699b2e413513ab2291c36`. Fixes stay on
`feat/pdf-gateway-hmac-public-review`; no merge, push, deployment or production
configuration changes are part of this audit.

## Problem and root cause

- **P2 — empty IAM token silently removes Authorization.** The new conditional
  header construction sent a valid HMAC request when an IAM supplier returned
  an empty string. A public Gateway could accept it despite the caller selecting
  private mode. The production federation supplier already rejects malformed
  token responses, so this is a provider-boundary regression, not evidence of a
  live federation bypass. A new regression reproduced dispatch before the fix.
- **P2 — approval schema coerces credential types.** `RegExp.test` coerced JSON
  arrays to strings; singleton URL/key arrays passed the purported exact schema.
  Regex end anchors also accepted a final newline. Private federation fields had
  the same coercion weakness. This requires modification of the operator file,
  not an unauthenticated HTTP exploit. Regression reproduced acceptance of a URL
  array. Both approval schemas now reject non-string credentials and whitespace;
  the provider independently checks URL/key types and literal approval.
- **P2 — operational instructions and source of truth diverged.** The accepted
  identity ADR still rejected public HMAC, current-state documentation omitted
  the opt-in, and emergency rollback put API recreation ahead of containing a
  compromised public Gateway. Clarify source-only acceptance, private default,
  public activation gates and containment order; verify effective IAM, not only
  the service flag. No operational command was executed.

## Decision and changes

Keep explicit public HMAC and default IAM + HMAC as separate modes. Reject empty
or whitespace IAM tokens before network dispatch. Retain exact seven-key file
contracts and add primitive string checks; no changes to API contracts, database,
financial rules, deployment files or production limits.

Add local HTTP integration between the actual approval loader/runtime/provider
and actual Gateway handler. Only Google metadata/Tasks/GCS are faked. Exercise
feature gating, queue readiness, task creation/status, result/claim reads and PDF
streaming with unique reserved nonces. Extend Gateway negative tests for method,
path and body tampering, both timestamp directions, CORS preflight, unknown
objects, malformed tasks and request overflow without Google calls.

## Verification

- Node 24.18.0/npm 12.0.1 on Windows. Use `npm.cmd`/`npx.cmd` because PowerShell
  script execution policy blocks the `.ps1` wrappers; no policy was changed.
- Before fixes, the two new regressions failed (empty IAM token and approval URL
  array), then passed after fixes.
- `npx.cmd tsx --test server/src/services/pdf-gateway-bootstrap.test.ts
  server/src/services/pdf-gateway-provider.test.ts
  server/src/services/pdf-gateway-identity.test.ts
  server/src/services/pdf-gateway-transport.test.ts
  server/src/services/pdf.service.test.ts`: **20 passed, zero skipped**.
- `node --test workers/pdf-gateway/server.test.mjs
  scripts/pdf-vps-config.test.mjs scripts/validate-pdf-environment.test.cjs
  scripts/pdf-cloud-readiness.test.mjs scripts/pdf-cloud-stage.test.mjs`:
  **37 passed, zero skipped**. Commands in staging tests use fakes only.
- `npm.cmd -w server run typecheck`, `npm.cmd run check:repo`,
  `npm.cmd run check:docs`, diff whitespace checks: passed.
- No server lint script exists. Client code is unchanged. Full CI, MySQL/browser
  suites and Linux worker rendering were not run: this diff changes transport
  authentication, not persistence, UI or rendering; relevant integration runs
  through real local HTTP without database/cloud credentials.
- `npm.cmd audit --omit=dev --json`: **failed**, 21 dependency entries
  (4 moderate, 15 high, 2 critical). This is not 21 independently demonstrated
  exploitable paths. Root/workspace manifests and lockfiles are unchanged from
  `main`; the owner explicitly kept dependency upgrades outside this PR audit.
  Notable reported entries include `proxy-addr`/`express` (critical),
  `body-parser` and `sharp` (high). These remain a separate remediation task;
  this report does not claim a clean dependency security audit.

## Documentation updated

Current status, producer identity ADR, Gateway operations and public-HMAC runbook
describe the explicit mode, strict credentials, producer-wide trust, timestamp
retention, existing private-only readiness tooling and emergency containment.

## Rollback

Revert the audit commit on the PR branch if needed; no migration or data rollback.
For any future approved activation, use the public-HMAC runbook: contain public
Gateway ingress first during compromise, verify no public invoker grant remains,
disable API/recovery, rotate the secret and preserve jobs/results. Reverting source
alone cannot revoke exposed secrets or change cloud IAM.

## Remaining risks

- Source/test review is not production approval. Live IAM/Worker privacy, secret
  custody and rotation, nonce lifecycle, recovery, real Drive E2E and total VPS
  resource/cost headroom remain unverified.
- Invalid HMAC is rejected before Google calls, but public requests still consume
  Cloud Run ingress/body parsing and billing resources. Local admission applies
  to authenticated operations and does not provide global abuse or cost caps.
- A compromised HMAC key authorizes all allowlisted PDF objects/tasks. User
  ownership and download tickets are enforced by the website API, not Gateway.
- Operator file checks assume a trusted parent directory. Windows tests cannot
  establish Linux owner/mode safety. Nonce retention must exceed the entire
  past/future timestamp interval plus clock-skew margin.
- Baseline dependency advisories above remain unresolved by explicit scope choice.

Result: scoped PR corrections and targeted checks PASS; dependency audit FAIL;
production activation remains unapproved. No temporary screenshots/logs or
baselines were committed.
