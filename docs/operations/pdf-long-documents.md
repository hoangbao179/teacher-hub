# PDF long documents: activation and rollback

Source implementation is complete across Worker/Gateway/API/Tools; production v2
activation is **not performed** here. Do not use offline benchmarks to certify
Google Drive/Cloud Run capacity, every Viewer layout or paper print quality.
See the [v2 contract](../api/pdf-worker-v2.md) for protocol and fixed budgets.

## Operational review before any separately approved activation

1. Migrate API schema with 0029. Existing rows retain worker version 1; new jobs
   select version 2 only with `PDF_CHUNKED_JOBS_ENABLED=true`. Do not edit existing
   rows to upgrade their protocol. Check column types/defaults and migration ledger.
2. Review/build immutable Worker and Gateway images from the same shared build.
   Keep Worker private, existing identities/HMAC/nonce policy and queue retries.
   No list/delete/create-Tasks permission is required for Worker. API outbox remains
   the producer; its independent recovery timer must run without a browser.
3. Resource review for v2: Worker **existing** 1 CPU/2 GiB, concurrency 1, request
   timeout >=180s, bounded memory scratch `/tmp/pdf-worker` at most **384 MiB** with
   >=320 MiB free. This is a proposed operator-provisioned mount, not an automated
   change. The old 32 MiB mount fails closed. Queue concurrency stays 1; review
   max instances (prefer 1 for the initial canary), min instances 0 and billing.
   Browser `/tmp` profiles, `/dev/shm`, image layers/logs and scratch all need room
   within the instance's total allocation. Do not move this work onto the VPS.
4. Gateway's **request timeout must accommodate 180s downloads**; its old 30s
   service timeout is insufficient even though enqueue itself is short. Set the
   chunk gate and existing `PDF_LONG_PRINT_TASKS_ENABLED=true` consistently on
   Gateway and API only after a compatible Worker is ready. Worker needs chunk
   gate and processing/fallback gates; v2 always requires Print for Viewer capture.
   Producer verifies authenticated `/v2/capabilities`; old Gateways fail closed.
   Existing v1 rollout/audit scripts still target their reviewed 32 MiB/30s contract;
   they are not an automated v2 resource approval or deployment mechanism.
5. Exercise permitted external Viewer other than Owner at 17/50/100/200 pages,
   rights rejection/login, native DPI, Vietnamese text/diacritics, blank/landscape
   pages, all-page order/content, actual printing, output size and slow downloads.
   No screenshot extraction when Print/Download is explicitly restricted. Verify
   browser processes/RAM, cold starts, max per-step duration and repeated jobs.
6. Test dropped task responses, killed Worker, lost part/checkpoint/result writes,
   exhausted retries, replay, source mutation, final merge and expired tickets.
   Verify refresh/new device shows cached progress and native download succeeds.
7. Verify existing seven-day GCS lifecycle covers source/parts/output/checkpoints,
   retention/storage budget, logs/image retention and nonce cleanup. Local scratch
   is cleaned after each invocation; remote checkpoints are intentionally retained
   until lifecycle cleanup. Downloads expire after 24h regardless of lifecycle.
8. Only after separate operational approval: enable API chunk gate in the existing
   host-owned `pdf-runtime/runtime.env` and recovery CLI environment; keep the
   approval file/credentials unchanged. No secret value belongs in Git or logs.

The one-minute reconciler can introduce approximately one minute between parts;
a 200-page Viewer job may take roughly 22 scheduling intervals plus actual work.
That is an asynchronous job, not an HTTP latency SLA. Each request is <=120s.
Do not substitute the benchmark's immediate local dispatch for real queue latency.

## Cost review (estimate, not measured billing)

Rates checked 2026-10-27: the official [Cloud Run request pricing table](https://cloud.google.com/run/pricing)
lists reference active CPU $0.000024/vCPU-s and memory $0.0000025/GiB-s. At those
reference rates, 1 CPU/2 GiB costs $0.000029/active second before free tier. The
96.48s offline 200-page run would correspond to about $0.0028 **if** it were
equivalent active cloud time; it excludes browser launches/network/queue cold
starts and is **not** a Cloud Run price measurement. An illustrative worst case
of 22 steps × 5 attempts × 120s is 13,200 active seconds, about $0.383 compute/job
at the same rates. Actual queue throughput, expiry and admission further constrain
load. Confirm selected-region SKUs/billing before approval; no budget guarantee.

Also account for Tasks requests, Gateway/nonce/metadata operations, seven-day GCS
retention (potentially ~105 GiB at admission ceiling), registry/build cache/logs
and outbound transfer to the VPS/user. [Storage billing](https://cloud.google.com/storage/pricing)
depends on storage class/location, operations and transfer; free tier must not be
assumed to cover this workload. No purchase or cloud configuration change was made.

## Reproduce offline benchmark

Build shared and the Worker image from the repository root. Run one workload per
disposable Docker container: network none, 1 CPU, 2 GiB memory/no swap, read-only
root, 384 MiB `/tmp`, writable `/evidence` bound only to ignored
`.artifacts/pdf-200/<run>/`, and read-only `workers/pdf/test` at `/app/worker/test`.
Set `XDG_CACHE_HOME=/tmp/cache`, then run `node test/chunk-benchmark.mjs N`, for
N=17/50/100/200 sequentially. Fake GCS is disk-backed, separate from scratch;
all generated PDFs are removed after verification. Only small aggregate metrics
are emitted. qpdf verifies final output; test-only pdf-lib reopens it to compare
every embedded image hash and native dimensions. Production never does that
whole-file read. Cgroup peaks include charged tmpfs/cache/verification; RSS is not
added to cgroup memory. These synthetic runs do not have a browser or cloud queue.

## Rollback

Stop admission of new v2 jobs first. Keep compatible Worker/Gateway, recovery and
large-file download transport available until in-flight v2 jobs finish or expire.
Their version is persisted, so changing the intake flag does not rewrite jobs.
Do not disable Gateway/Worker chunk handling while v2 jobs/downloads are active.
API's current single chunk flag also controls continuation: disable only after
draining, or pending v2 work intentionally stalls safely until it is restored.

Restore prior immutable images/config only after draining. Keep additive columns
and existing GCS objects; old API code ignores them. No destructive down migration
or automatic backfill is needed. A failed schema rollout can be re-run: the
recovery routine recognizes both completed ALTER columns before recording 0029.
Never drop job history/checkpoints or alter IAM/traffic to hide a failed canary.
