# PDF job API — Task 2

> **Product requirement (chưa triển khai đủ):**
> [PDF từ liên kết Viewer](../product-spec/pdf-viewer-links.md).
> Form chuẩn tương lai là **dán link → Tạo PDF**, không checkbox xác
> nhận quyền tải. Hợp đồng API hiện còn `rightsConfirmed:true`,
> lưu legacy `rights_confirmed_at`; không xem đó là quyết định UX được
> chủ dự án duyệt. Một PR code riêng phải đồng bộ shared contract,
> OpenAPI, API validation, UI, tests và bảo toàn compatibility/idempotency.

Status: backend implemented for local/fake verification; production unavailable.
The public `/tools` UI uses the public endpoints described below. Use [OpenAPI](../api/openapi.yaml), shared
contracts in `shared/src/contracts/pdf.ts` and the unchanged [Worker v1](../api/pdf-worker-v1.md).

## Task 3 API usage

All `/api/pdf/*` routes require the existing Bearer session, TEACHER role and an
ACTIVE database user. Every batch/job query is scoped to that owner. Public tools
must not call these endpoints. Responses use `{data:...}` or the existing error
envelope. Capabilities is authoritative: show unavailable when submitEnabled=false;
do not present submission/download actions as working while the gate is closed.

1. GET capabilities. Limits default to five links/batch, ten active jobs, ten
   batches/hour and fifty job creations/hour including manual retries.
2. POST batches with `Idempotency-Key: <lowercase UUID-v4>` and
   `{links:["https://drive.google.com/file/d/FILE_ID/view"]}`. Older clients may send `rightsConfirmed:true` for compatibility.
   Also accepted: `https://drive.google.com/open?id=FILE_ID`. Only these exact
   shapes are supported; no extra query, resource key, credential, fragment,
   confirmation/download URL or native Docs URL is accepted. Duplicate normalized
   file IDs within a batch are rejected. Store and reuse the key after HTTP errors.
3. GET batches?page=1 (fixed page size 20), then GET batches/:id to poll details.
   Poll no faster than 15 seconds. Each detail/create/retry request performs at
   most three due jobs, with durable next-action times and leases. Five-link
   batches may initially include ENQUEUE_PENDING jobs; the independent one-shot
   reconciler drains subsequent jobs without an open browser. Its verified schedule
   is required before production activation. Refresh/login reads persisted history.
   Do not equate HTTP 201 or QUEUED with PDF completion.
4. POST jobs/:id/retry with a new idempotency key only for FAILED,
   RETRY_EXHAUSTED or EXPIRED. A manual retry creates a fresh Worker UUID linked
   by retryOf, preserving immutable Worker terminal results. At most two retries
   in a chain; only one successor per attempt. Reusing the retry key returns that
   same successor. An active reconciliation lease rejects retry with PDF_RETRY_BUSY
   (409); retry that request/key after recovery releases the lease. Transient
   enqueue retries happen automatically on the same UUID. RESULT_UNCONFIRMED
   cannot spawn a successor before expiry; it keeps polling and becomes EXPIRED
   at its deadline, after which a capped explicit manual retry is available.
5. POST jobs/:id/download-ticket for COMPLETED/unexpired jobs. Receive a one-use
   ticket, downloadPath and expiresAt. POST that path with `{ticket}` and Bearer
   auth, consume the binary response as a download. Ticket TTL <=120 seconds and
   <=job expiry. Do not put tickets in URLs/storage/logs. Streaming is bounded to
   validated bytes (<=10 MiB), one concurrent stream per process and <=30 seconds
   or earlier job expiration. Attachments use application/pdf, nosniff and no-store.
   Interrupted streams require a fresh ticket; partial files must be discarded.

Batch creation stores the server timestamp; legacy `rights_confirmed_at` remains as a database/DTO field but is **not evidence of confirmed rights**. New clients do not assert download permission, and Google permissions still apply.
Only normalized fileId is persisted; no raw link, cloud token, signed URL or PDF
bytes enter MySQL. Ticket storage contains only a SHA-256 token hash.

## State and recovery

| State | Meaning / next action |
| --- | --- |
| ENQUEUE_PENDING | durable intent, not dispatched yet |
| ENQUEUE_RETRY | transient/ambiguous enqueue error; same deterministic task name |
| QUEUED | task created or already exists; worker state is not known |
| COMPLETED | validated durable Worker result and matching source claim |
| FAILED | validated Worker permanent failure; see errorCode |
| RETRY_EXHAUSTED | optional positive evidence: matching retry policy, counts/time, failed completed response, no in-flight attempt and 60-second quiescence; late-result polling continues |
| RESULT_UNCONFIRMED | task missing, pending result beyond two hours, or eight actual enqueue attempts; not proof of PDF failure |
| EXPIRED | application deadline passed; no download even if object exists |

Cloud read/transport errors use cloudErrorCode without inventing PDF failure.
They are polled again after the stored interval. Missing task alone is ambiguous
because successful and exhausted tasks are both deleted. Task metadata is optional
evidence, not the durable source of Worker outcome. RESULT_UNCONFIRMED and
RETRY_EXHAUSTED both continue late-result polling until expiry, including after
the task is deleted. A validated Worker result wins over those observations.
A fresh WAITING observation invalidates older exhaustion evidence and returns
RESULT_UNCONFIRMED; a missing task alone does not erase previously observed proof.
Known Worker terminal results are cached in MySQL; expired jobs
are projected EXPIRED, including permanent failures. Before a Worker claim is known,
jobs have a conservative 24-hour submission deadline. Validated results use the
claim's exact 24-hour expiresAt; authorization never relies on seven-day lifecycle.

Owner-row locking serializes idempotency/capacity checks with all inserts. Each job
row is its own transactional outbox item. Leases last 60 seconds and use a UUID
compare on updates, so a restart or concurrent reconciler cannot apply stale writes.
No network call occurs inside a transaction. Task names are `pdf-<jobId>` in the
fixed queue. Create timeout retries the same name; ALREADY_EXISTS is reconciled.
No task is recreated with a new UUID automatically. A GCS read failure does not
consume an enqueue attempt before Cloud Tasks creation was attempted.

The independent runner invokes one leased job per step, repeatedly, until idle,
disabled, 50 steps or 45 seconds by default. Both limits can be lowered. Cloud
operations inherit the run's AbortSignal and retain a four-second per-call bound.
The CLI exits forcibly after 50 seconds if DB/driver cleanup cannot finish; the
next scheduled invocation reclaims abandoned leases. No daemon is added.

## Production blockers

The [identity ADR](../decisions/ADR-pdf-producer-identity.md) accepts the Gateway
direction, not production activation. `PDF_API_ENABLED=true` alone cannot activate
submission or downloads. HTTP and CLI share createPdfRuntime and the private
approval-file loader. Reviewed federation, HMAC, activation and recovery attestations
are required. Operator reports private Worker/Gateway processing PASS, but no VPS
issuer is confirmed. Token renewal, live recovery and website cloud E2E remain
blocked until that identity is configured. UI must display unavailable while
capabilities are disabled. See the activation runbook below.

## Public guest Tools (Task 3 change)

The public website `/tools` requires no login. Everyone can list public-tool
batches, read their details, retry eligible jobs and download completed/unexpired
PDFs on a different device. These operations do not require the submitting
browser's cookie. Clearing or expiring that cookie does not remove public history.
Only records linked through `pdf_guest_batches` are public; private teacher batches
are rejected by public detail/retry/ticket/download, including when their UUID is
known. Teacher history list and count exclude public batches.

POST `/session` issues a Secure (production), HttpOnly, SameSite=Strict cookie
scoped to `/api/public/pdf`. Only submission needs this cookie, to scope the
idempotency key. Every public mutation requires the exact website Origin. Creating
the batch, job outbox and public link is one transaction. A link insert failure
rolls back all three; enqueue occurs after commit. Retrying the same key/body in
the same submission session returns the same batch. No teacher JWT is created.
Guest work shares the teacher-wide capacity/cost ceiling and the existing limits
of five combined submit/retry requests and ten session requests per IP per hour.
See the [trusted proxy boundary](../operations/production.md#trusted-proxy-and-client-ip)
for the actual client IP. Public binary 401 responses leave the teacher session intact.

Initial load and manual refresh read all visible details with at most four
concurrent requests. Automatic refresh runs at most once per 15 seconds while
visible, reads list/capabilities to discover new batches, and only loads unknown
or recoverable unexpired batch details. COMPLETED/FAILED/EXPIRED details are cached
until manual refresh or page reload. RESULT_UNCONFIRMED and RETRY_EXHAUSTED remain
pollable until expiry because a late result can supersede them. Manual refresh
also discovers retries from another device for a cached terminal batch.

PDFs have a temporary 24-hour download window (Worker claim deadline once known;
conservative submission deadline before that), not permanent public URLs. History
remains after expiry; retry creates a new capped job. Tickets are one-use POST
body values, never URL/storage values. There is no automatic upload to cô Vy's
Google Drive. Production processing/download remains disabled until the approved
identity, queue, Worker, GCS and independent recovery gates pass.

### Follow-up: original document names

Worker v1 returns file ID and result metadata, not the original filename. The UI
explicitly identifies its current name as a fallback derived from the Drive ID.
The unauthenticated direct-download worker has no trusted Drive metadata service;
adding a Google API lookup to the VPS would add identity, permission and request
costs. Do not infer the name from viewer HTML or claim that the fallback is original.
A separate reviewed change should capture and sanitize a trusted filename at the
Worker's accepted download response, or provide approved Drive metadata access,
then version/update result validation, shared DTO, persistence and tests together.
Current strict Worker v1 result fields are unchanged; this PR does not claim real names.

## Production transport and availability

Gateway transport requires both a Google ID token obtained through explicit OIDC federation and the existing HMAC signature. Public/admin HTTP and recovery CLI share the approved configuration. No issuer is confirmed on the VPS; capabilities remain unavailable until identity renewal, independent recovery, real PDF and cross-device/expiry checks pass. The [activation runbook](../operations/pdf-vps-activation.md) is authoritative for deployment gates. No API contract or 24-hour retention rule changes.
