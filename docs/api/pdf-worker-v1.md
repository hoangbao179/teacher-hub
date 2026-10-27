# PDF worker contract v1

> **Phạm vi source v1, không phải yêu cầu nghiệp vụ cuối cùng.** Đọc
> [Viewer PDF product contract](../product-spec/pdf-viewer-links.md).
> Worker chỉ hỗ trợ file được tải trực tiếp; `Cloud PDF E2E: PASS` với
> file public downloadable không chứng minh hỗ trợ mọi liên kết Viewer.
> Không thêm viewer screenshot bypass khi owner/admin tắt tải/copy/print.

Status: implemented for local fixture verification; production processing disabled.
No Teacher Hub API, database, queue dispatch or teacher download authorization is
implemented here. Task 2 consumes this contract; Task 3 and cloud E2E remain gates.

## Transport and request

Cloud Tasks sends `POST SERVICE_BASE_URL/jobs`, `Content-Type: application/json`:

```json
{
  "version": 1,
  "jobId": "55b797f0-e128-4525-8df5-c3cb92163167",
  "source": { "provider": "google_drive", "fileId": "owned_fixture_12345" }
}
```

Exactly these fields are accepted at both levels. Version is integer `1`.
Job ID is a lowercase UUID-v4 (RFC variant); file ID matches
`^[A-Za-z0-9_-]{10,128}$`. Body limit is 4096 bytes. No URL, bucket, output path,
resource key, credentials or export options can be supplied. These TypeScript
types and runtime guards live in `workers/pdf/src/contract.ts`, outside the
client/server workspaces. Task 2 must test payload compatibility against these
guards rather than invent another worker contract.

Cloud Run IAM validates OIDC before worker code. Use
`teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com`; audience is exactly
the service base URL, without `/jobs`. `X-CloudTasks-*` headers grant no authority
and are not used for authentication or idempotency. Local listeners are loopback
only; dependency injection is exclusively for controlled tests, never HTTP input.

## Responses and retry policy

| HTTP | Body | Producer/Cloud Tasks meaning |
| --- | --- | --- |
| 200 | Result below, COMPLETED or FAILED | Terminal state durably stored; ACK even for permanent processing failure |
| 400 | `{ "error": "INVALID_REQUEST", "retryable": false }` | Fix producer payload; no job accepted |
| 413 | `{ "error": "BODY_TOO_LARGE", "retryable": false }` | Fix producer payload |
| 409 | `{ "error": "JOB_CONFLICT", "retryable": false }` | UUID already bound to another source; never repurpose IDs |
| 404 | `{ "error": "not_found" }` | Processing disabled (default), unsupported route/method |
| 503 | `{ "error": "CODE", "retryable": true }` | Retry with the same job ID and source |

Cloud Tasks retries non-2xx regardless of the JSON `retryable` field. Task 2 must
validate before enqueue, cap queue attempts/retry duration, reconcile exhausted
tasks in MySQL and never enqueue while the activation gate is closed. No worker
2xx is sent for an unpersisted transient error. A dropped connection also retries.

Permanent processing codes stored as FAILED: `ACCESS_DENIED` (401/403/404,
login redirect or explicitly disabled Print control), `PRINT_UNAVAILABLE`
(no visible matching Print control; restriction vs UI mismatch is unverified),
`UNSUPPORTED_SOURCE` (HTML/confirmation/native-document response,
unsafe redirect, encrypted PDF), `INVALID_PDF`, `FILE_TOO_LARGE`,
`PAGE_LIMIT_EXCEEDED`, `JOB_EXPIRED`.
Transient 503 codes: `SERVICE_UNAVAILABLE` (gate/config/permissions),
`SOURCE_UNAVAILABLE` (429/5xx), `STORAGE_UNAVAILABLE`, `TIMEOUT`, `INTERNAL_ERROR`
(sanitized unexpected I/O, DNS or transport error). No stack, source URL or provider
diagnostic text is returned or logged. Fixed, allowlisted diagnostic classifications
are logged internally as described below. A worker timeout is not persisted as permanent.

## Safe internal diagnostics

Worker emits JSON `event=pdf-stage-failed` for a direct failure before fallback
and for the final processing failure. Fields are `jobId`, SHA-256 `sourceHash`
(same claim hash), `stage`, `fallbackEnabled`, allowlisted `code`/`reason`, and
`retryable`. Stages distinguish direct download/validation, Viewer render/validation
and storage. Reasons distinguish HTML, encryption, redirects, HTTP access,
missing/ambiguous/disabled Print, unreadable page totals, ambiguous Viewer layout
(multiple visible headings/images or a visible toolbar in the page wrapper),
oversized/low-DPI bitmaps and assembled page-count drift. `FILE_TOO_LARGE` reasons
distinguish per-page PNG budget, cumulative PNG (32 MiB working set), embedded
JPEG total (within output cap minus structure headroom), serialized PDF output,
direct download and post-validation size. Byte-budget failures may include
allowlisted `pageIndex`, `usedBytes` and `limitBytes`. Layout failures may
include allowlisted `pageIndex` and `ancestorLevel` (wrapper depth). Unknown details become `unclassified` or
`INTERNAL_ERROR` in logs; result/retry semantics retain the existing contract.
No source ID/URL, body, cookies, tokens, parser stderr or stack is logged.
Encrypted PDF validation never triggers Viewer fallback. A failed logging sink
cannot prevent result persistence. No diagnostic field is added to HTTP/GCS results.

## Durable objects and result schema

Fixed private bucket: `teacher-hub-pdf-results-2026`.

```text
jobs/<jobId>/request.json
jobs/<jobId>/output.pdf
jobs/<jobId>/result.json
```

`request.json`: `{ version: 1, sourceHash, createdAt, expiresAt }`. Hash is SHA-256
of JSON `{provider,fileId}` in that order; no raw source ID or URL is stored.
Expiry is 24 hours after the first claim. All timestamps are UTC ISO strings.

Successful `result.json` and HTTP 200 body:

```json
{
  "version": 1,
  "jobId": "55b797f0-e128-4525-8df5-c3cb92163167",
  "status": "COMPLETED",
  "objectName": "jobs/55b797f0-e128-4525-8df5-c3cb92163167/output.pdf",
  "bytes": 12345,
  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "pages": 2,
  "completedAt": "2026-10-24T08:00:00.000Z",
  "expiresAt": "2026-10-25T08:00:00.000Z"
}
```

FAILED has `version`, `jobId`, `status`, `errorCode`, `completedAt`, `expiresAt`;
it has no output/checksum/size/pages fields. Bytes/pages are positive integers.
The SHA-256 above is a synthetic schema example, not a measured file checksum.
PDF custom metadata contains `sourceHash`, decimal `bytes`/`pages`, `sha256`,
`completedAt`, atomically uploaded together with the original PDF bytes.
Worker creates no signed/public URL and grants no user download permission.

## Idempotency and partial failures

Every object creation uses `ifGenerationMatch=0`; overwrites/deletes are never
requested. A 412 is a race to be read and reconciled, not a successful blind ACK.
The immutable claim binds the UUID to a single source before source access.
An existing terminal result is authoritative and returned unchanged. A new UUID
is required to retry a FAILED job after the source or permission changes.

If output exists without a result, its source hash and validation metadata are
checked, then COMPLETED is created without re-downloading. If upload succeeds but
the response or result write fails, the next delivery performs this same recovery.
If result creation loses a generation race, read and return the terminal winner.
No second output name is generated. Concurrent requests across instances may
download the same source, but only one output and one result can be created.
If a concurrent permanent failure wins before another attempt uploads, FAILED
remains authoritative; any orphan PDF is inaccessible to users and expires by
bucket lifecycle. This intentionally favors immutable terminal state over repair.

Claims without a result expire after 24 hours and persist JOB_EXPIRED. Existing
results retain their original expiration even on late delivery. Task 2 must deny
downloads after `expiresAt`, cap retries below 24 hours and never reuse job UUIDs,
including after bucket lifecycle deletes their claims. The configured seven-day
lifecycle is eventual cleanup, not application authorization or expiry logic.
Do not remove claims/results independently while queue deliveries remain possible.

## Limits and security boundaries

| Limit | Default / hard ceiling |
| --- | --- |
| PDF_MAX_BYTES | 20971520 (20 MiB product default from `@teacher/shared`), may only be lowered |
| PDF_MAX_PAGES | 40, may only be lowered |
| PDF_DEADLINE_MS | 22000 ms, may only be lowered; includes body/storage/source/parser |
| Redirects | 3; bodies discarded without following HTML links/forms |
| Source headers / DNS | Node 16 KiB header default; IPv4 DNS 2 s, one try |
| qpdf subprocess | 512 MiB address space; 5 CPU seconds; 6 s wall per invocation; 16 KiB diagnostics |
| Storage JSON | 16 KiB per response; no SDK/background retries |
| Temporary volume | explicit tmpfs at /tmp/pdf-worker, at most 32 MiB |
| Per-instance processing | one job; overlapping request returns 503 |

The worker constructs only `https://drive.google.com/uc?export=download&id=ID`.
Allowed redirect destinations are HTTPS `drive.google.com/uc` and
`drive.usercontent.google.com/download`, default port, no credentials or fragment.
DNS answers must all be public IPv4; the selected address is pinned into the TLS
connection with normal hostname/certificate validation. IPv6 is refused. No
cookies, authorization headers, viewer scraping, print fallback, CAPTCHA or
download-confirmation form submission is used. MIME type does not establish PDF
validity. One bounded file is streamed to disk; magic bytes and qpdf strict checks,
encryption check and page count are required before upload. Parser warnings fail.
No rasterization/recompression occurs. Validation is not malware sanitization;
Task 2 must serve downloads as attachments with appropriate browser headers.

Original bytes are preserved; embedded links, scripts, signatures and other PDF
features are not removed or certified safe. qpdf cannot prove semantic fidelity
or that an owner intended this caller to use a document. Operators/teachers must
use authorized documents. Resource-key links and other Google hosts may fail
closed; public Drive behavior remains externally unverified.

References: [GCS create preconditions](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert),
[permission preflight](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets/testIamPermissions),
[qpdf checks](https://qpdf.readthedocs.io/en/stable/cli.html),
[Drive download mechanisms](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
