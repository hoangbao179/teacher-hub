# PDF anonymous print fallback — consolidated implementation change

## Task level

**Level 3:** Cloud Run Worker browser execution, cross-service Cloud Tasks
deadline gate, Docker dependencies and production-deployment template.

## Problem and root cause

The original `/tools` Cloud Run Worker accepted only anonymous *direct PDF
downloads*. A Viewer page that could be opened in a browser but returned HTML
or access restrictions at the direct endpoint produced FAILED; PR #16 added a
local image-PDF PoC but did not connect it to Cloud Tasks. The current live task
dispatch deadline and Cloud Run request timeout are 30 seconds, too short for
a potentially multi-page rendered-PDF job.

## Decisions and boundaries

- Preserve existing Gateway HMAC authentication, private Worker OIDC, queue,
  request schema, MySQL outbox, GCS object paths/TTL, ticket download protocol,
  and direct download fast path.
- **Explicitly opt in** to Chromium capture of anonymous, Viewer/Print-enabled
  pages, only after direct `ACCESS_DENIED`/`UNSUPPORTED_SOURCE`. No login,
  supplied browser cookies, authenticated-only links or Print-disabled bypass.
- Produce an **image-only printable A4 PDF** with original page orientation
  and page order; no OCR/search requirement. Validate generated result with
  the unchanged qpdf process and GCS claim/recovery.
- The existing direct-only Worker deadline (22 seconds) remains default.
  An opt-in Worker flag allows up to 120 seconds and a separate matching
  producer/Gateway opt-in supports 180-second Cloud Tasks dispatch deadlines.
  New Cloud Run *no-traffic* worker stage timeout is 180 seconds; default
  print and long-task flags remain off.
- The browser has application-level allowlisted resource routing, bounded
  page count/pixels, observed wire bytes, capture bytes and output bytes.
  It runs as a non-root container process, but chromiumSandbox=false is
  **not a strong web-content isolation proof** and network allowlisting is
  not a firewall/DNS pinning. Real security and cost review is required
  before production.

## Changed areas

- `workers/pdf/src/renderer.ts` / `print-policy.ts`: anonymous browser
  print-page capture and print geometry.
- `workers/pdf/src/processor.ts`: fallback injection and unchanged GCS output.
- `workers/pdf/src/http.ts` / `contract.ts`: default-off activation,
  bounded deadline and existing preflight.
- Worker `Dockerfile`, `package.json`, lock: pinned browser/dependencies.
- `server/src/services/pdf-gateway-provider.ts` and
  `workers/pdf-gateway/src/server.mjs`: version-compatible, gated 180s tasks.
- `scripts/pdf-cloud-stage.mjs`: private no-traffic 180s Worker timeout,
  default-off experimental flags; Gateway stays 30s.
- Tests, Worker docs, operations and implementation status.

## Verification

- Worker typecheck, source/request policy tests and fake-renderer integration
  tests run in CI. Verify all provider/Gateway/staging suites with the flag off
  and on. Existing direct-PDF cloud and UI flows must remain unchanged.
- **Still required:** real authorized anonymous Google Drive Viewer whose
  **Print is enabled**, Chromium runtime/container smoke, Cloud Run no-traffic
  E2E, qpdf PDF fidelity/page order/crop, paper print check, memory/CPU/egress
  telemetry and cost. No claim of working with the owner's two failed jobs
  until those have been checked in production or an equivalent isolated run.
- Do not infer that the earlier local, owned synthetic fixture represents
  print-disabled or login-required Drive documents.

## Activation and rollback

No live service/IAM/secret/queue mutation in this PR. Stage revisions with
no traffic. Promote the Gateway version first, enable its
`PDF_LONG_PRINT_TASKS_ENABLED=true`, then deploy/enable the private Worker
`PDF_PRINT_FALLBACK_ENABLED=true` and `PDF_DEADLINE_MS=120000`;
finally enable `PDF_LONG_PRINT_TASKS_ENABLED=true` on the API/VPS.
Observe initial canary jobs and quotas before exposing widely.
Rollback: turn off the API long-task flag first, drain in-flight jobs, then
Worker Print flag and Gateway long-task flag; route back to the prior immutable
Worker/Gateway revisions if necessary. Do not delete GCS jobs or MySQL rows.

## Remaining risks

Google Viewer UI/DOM can change and print-quality / available resolution
vary by document. Cloud Run cold start and network latency may exhaust budgets.
Non-headless browser resource containment (egress, sandbox, temp paths)
requires explicit validation. The public print-disabled path is intentionally
unsupported. Production readiness is **NOT claimed** by code-only CI.
