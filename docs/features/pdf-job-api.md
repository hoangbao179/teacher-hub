# PDF job API — Task 2

Status: backend implemented for local/fake verification; production unavailable.
No UI or public `/tools` call is added. Use [OpenAPI](../api/openapi.yaml), shared
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
   `{links:["https://drive.google.com/file/d/FILE_ID/view"],rightsConfirmed:true}`.
   Also accepted: `https://drive.google.com/open?id=FILE_ID`. Only these exact
   shapes are supported; no extra query, resource key, credential, fragment,
   confirmation/download URL or native Docs URL is accepted. Duplicate normalized
   file IDs within a batch are rejected. Store and reuse the key after HTTP errors.
3. GET batches?page=1 (fixed page size 20), then GET batches/:id to poll details.
   Poll no faster than 15 seconds. Each detail/create/retry request performs at
   most three due operations, with durable next-action times and leases. Five-link
   batches may initially include ENQUEUE_PENDING jobs. Refresh/login recovers the
   same persisted history. Do not equate HTTP 201 or QUEUED with PDF completion.
4. POST jobs/:id/retry with a new idempotency key only for FAILED,
   RETRY_EXHAUSTED or EXPIRED. A manual retry creates a fresh Worker UUID linked
   by retryOf, preserving immutable Worker terminal results. At most two retries
   in a chain; only one successor per attempt. Reusing the retry key returns that
   same successor. Transient enqueue retries happen automatically on the same UUID.
5. POST jobs/:id/download-ticket for COMPLETED/unexpired jobs. Receive a one-use
   ticket, downloadPath and expiresAt. POST that path with `{ticket}` and Bearer
   auth, consume the binary response as a download. Ticket TTL <=120 seconds and
   <=job expiry. Do not put tickets in URLs/storage/logs. Streaming is bounded to
   validated bytes (<=10 MiB), one concurrent stream per process and <=30 seconds
   or earlier job expiration. Attachments use application/pdf, nosniff and no-store.
   Interrupted streams require a fresh ticket; partial files must be discarded.

Batch creation stores server timestamp, confirmed rights and terms version. This
audit assertion does not establish document rights or bypass Google restrictions.
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
| RETRY_EXHAUSTED | positive failed-response/count/time evidence, no in-flight attempt |
| RESULT_UNCONFIRMED | missing result beyond two hours, or eight ambiguous enqueue attempts; not proof of PDF failure |
| EXPIRED | application deadline passed; no download even if object exists |

Cloud read/transport errors use cloudErrorCode without inventing PDF failure.
They are polled again after the stored interval. Missing task alone is ambiguous
because successful tasks are deleted too. RESULT_UNCONFIRMED continues late-result
polling until expiry. Known terminal results are cached in MySQL; expired jobs
are projected EXPIRED, including permanent failures. Before a Worker claim is known,
jobs have a conservative 24-hour submission deadline. Validated results use the
claim's exact 24-hour expiresAt; authorization never relies on seven-day lifecycle.

Owner-row locking serializes idempotency/capacity checks with all inserts. Each job
row is its own transactional outbox item. Leases last 60 seconds and use a UUID
compare on updates, so a restart or concurrent reconciler cannot apply stale writes.
No network call occurs inside a transaction. Task names are `pdf-<jobId>` in the
fixed queue. Create timeout retries the same name; ALREADY_EXISTS is reconciled.
No task is recreated with a new UUID automatically.

## Production blockers

The [identity ADR](../decisions/ADR-pdf-producer-identity.md) is proposed, not a
grant or an approval. Application/CLI factories deliberately supply a disabled
provider. `PDF_API_ENABLED=true` alone cannot activate submission or downloads.
REST transport is implemented and tested with an injected verified identity, but
production token acquisition/wiring remains blocked on operator identity review,
Worker activation, OIDC, bucket permissions, queue verification, reconciliation
and private cloud E2E. Task 3 can build against shared contracts/fake tests and
must display unavailable on the real disabled backend. No production readiness claim.
