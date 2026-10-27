# PDF Worker v2: durable parts

Implemented source, opt-in only. Real authorized Viewer/Cloud Run E2E and actual
paper print quality are not established by offline fixtures. The existing
[v1 contract](pdf-worker-v1.md), API authorization, HMAC/nonces, IAM and download
tickets remain compatible. No new cloud credentials or permissions are needed.

## Protocol and state

Shared contracts/guards live in `shared/src/pdf-pipeline.ts`; budgets in
`shared/src/pdf-limits.ts`. A bounded POST /jobs payload is:

```json
{"version":2,"jobId":"55b797f0-e128-4525-8df5-c3cb92163167","source":{"provider":"google_drive","fileId":"owned_fixture_12345"},"step":0}
```

Only these exact fields are accepted. UUID/Drive ID retain v1 validation. Step
0 discovers the source/count; steps 1..ceil(pages/10) process one derived range;
the last step merges. Maximum step is 21. Caller cannot choose a range, bucket,
object name, URL or path. All steps are separate deterministic Tasks named
`pdf-<jobId>-s<step>`, POST /jobs, private Worker OIDC, 180s dispatch, 120s handler.
One instance processes one request; the existing queue admits one dispatch.

Worker returns HTTP 200 only after a durable checkpoint or terminal result.
Checkpoint ACK is `{version:2,jobId,step,status:"CHECKPOINTED"}`; it is **not** a
COMPLETED job. The API reads GCS, not Task response bodies. Permanent errors and
successful terminal results retain the exact v1 result/24h claim schema. Transient
source/storage/parser deadline failures return non-2xx for retry of that step.

Private objects under `jobs/<jobId>/`:

- `request.json`: immutable v1 source hash and exact 24h expiration.
- `source.pdf`: immutable direct-source snapshot, only when splitting is needed.
- `manifest.json`: version/job/source/expiry, mode, total count and fingerprint.
- `parts/<n>.pdf` and `<n>.json`: immutable validated PDF then checkpoint with
  source fingerprint, exact range, byte count and SHA-256.
- `output.pdf`, then `result.json`: validated final output, followed by terminal
  publication. An uploaded output without a result is recovered on redelivery.

Every creation uses generation-match zero. A duplicate losing upload rereads the
winner before checkpointing. A lost checkpoint is recovered from stored part PDF
and metadata without rendering it again. Each successor requires all preceding
checkpoints; final merge downloads ordered parts through byte-bounded streams,
checks hashes/counts, invokes isolated qpdf, then validates final count/structure.
No all-document image/PDF buffer is held by production code. The streaming writer
retains one JPEG plus O(pages) numeric xref offsets. qpdf has a separate 512 MiB
address-space cap and can have its own native allocations/caches.

Direct PDF <=50 pages can complete in discovery with original bytes, satisfying
source/output caps. Long direct PDFs are split from the same checksum-verified
GCS snapshot. Viewer discovery and every part use a fresh anonymous browser,
the same print-gated or view-only tile capture as v1 when screen capture is
enabled, >=200 native effective DPI and a first-page PNG fingerprint; changed
totals/anchor fail. No Google login/session replay.
The anchor cannot prove that a later page did not change while count/page one
stayed identical. Immutable direct bytes are preferred when available; real
Viewer mutation/layout/virtualization behavior needs authorized E2E.

## API, reconciliation and UI

Migration 0029 adds `worker_version` (existing rows default 1) and nullable
`progress_json`. Recovery recognizes a completed atomic ALTER whose ledger insert
was interrupted. Existing job IDs never switch protocol versions.

The existing 60s DB lease/outbox controls dispatch. Reconciliation reads the claim,
manifest and up to five new contiguous checkpoints per sweep, respecting Gateway
read admission; previously validated prefixes are cached in MySQL. A 15s aggregate
cloud progress budget bounds the sweep. Next-step enqueue is idempotent; attempt
count resets when the step advances. Positive exhaustion remains distinct from
missing/ambiguous task state. Late terminal results continue to reconcile.

`PdfJob` adds optional `workerVersion` and `progress` with stage, processedPages,
totalPages, percent and nextStep. 99% means all pages exist but final PDF has not
been published; UI displays 100% only for COMPLETED. Existing status enums stay.
Refresh fetches DB-backed history/progress. Public/private visibility and expiry
authorization remain unchanged. Public v2 downloads POST a one-use ticket using a
native form; urlencoded parsing is scoped to that download route (1 KiB/one field),
exact Origin remains mandatory, and no ticket enters URLs/storage. JSON download
remains compatible. Browser-managed downloads do not allocate a 150 MiB JS Blob;
an interrupted native download requires a fresh ticket and browser retry.

Gateway v2 capabilities and metadata/task routes require HMAC and durable nonce
reservation. They expose only fixed manifest/checkpoint JSON, never source/part PDF
paths. Producer verifies advertised v2 budgets before enabling submission. Binary
output is limited to 150 MiB only with the explicit chunk gate. API validates each
result using its persisted worker version, not caller-supplied limits. Gateway/API
download deadline is 180s, bounded further by job expiry; Nginx disables buffering
for attachments with 190s idle headroom, avoiding VPS temporary PDF spooling.

## Budgets and threat model

| Resource | v2 bound |
| --- | --- |
| Pages / part | 200 / 10 |
| Original source / one part | 20 MiB / 20 MiB |
| Final output | 150 MiB; parts sum reserves 2 MiB structure headroom |
| Native bitmap | 12 MP, >=200 DPI, PNG encoded bytes <=32 MiB/page |
| Scratch filesystem | at most 384 MiB; >=320 MiB free before admission |
| Final merge footprint | <=148 MiB parts + <=150 MiB output, plus bounded overhead |
| qpdf validation | 512 MiB address space; v2 45 CPU s / 50s per call, whole-task 120s |
| qpdf merge | 512 MiB address space; 25 CPU s / 30s wall |
| Queue retries | existing 5 attempts / 3600s per independently named step |
| API admission | at most 1 link/batch, 2 active jobs, 2 creations/hour, including retries |

All CPU deadlines include cancellation and cleanup. Signals and CPU kills are
transient TIMEOUT, not proof of malformed PDF. No memory/container/VPS quota was
raised automatically. Runtime v2 refuses the old 32 MiB scratch mount. Source
bytes, encoded PNG, decoded bitmap, total scratch and RSS are distinct budgets.
Workers never fetch supplied arbitrary URLs; existing Drive SSRF/egress rules apply.
Parser/browser isolation is not antivirus. Original direct PDFs retain embedded
features; serve attachments with nosniff/no-store as before.

Local job directories are deleted on success/failure/abort; process/instance loss
leaves only bounded ephemeral storage. Durable checkpoints intentionally remain
for recovery and are inaccessible through public download routes. Existing bucket
seven-day lifecycle supplies eventual remote cleanup, while application access
expires after 24h. No delete/list IAM grant or lifecycle mutation is added.
At the configured intake ceiling, seven-day retained data can approach 105 GiB
(2 jobs/hour × 168h × 320 MiB), plus small checkpoint/nonces/logs. Operator must
verify lifecycle, storage spend/retention and concurrent-instance limits before
activation; shortening lifecycle needs a separate operational change.

See [operations and cost review](../operations/pdf-long-documents.md) and the
[consolidated evidence](../changes/2026-10/pdf-200-page-pipeline.md).
