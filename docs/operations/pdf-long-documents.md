# PDF long documents: activation and rollback

Worker/Gateway/API/Tools support v2; activation is managed by the production
Actions pipeline described below. A successful deployment gate is not real-Drive
E2E acceptance. Do not use offline benchmarks to certify
Google Drive/Cloud Run capacity, every Viewer layout or paper print quality.
See the [v2 contract](../api/pdf-worker-v2.md) for protocol and fixed budgets.

## Automated production activation

After main CI passes, `deploy.yml` dispatches `pdf-worker.yml` on main with the
exact source SHA and a unique run/attempt ID, waits for its successful conclusion,
and retrieves only that run's nonsecret readiness evidence. This preserves the
existing WIF condition (manual-dispatch event, exact workflow/main/environment);
there is no new GCP credential, IAM change, Cloud Run deployment or traffic switch.
The reusable deployment caller grants `actions: write` to dispatch this workflow.
Both workflows serialize their respective production/cloud verification runs.

`pdf-v2-readiness.mjs` pins the reviewed Worker `00017-guf` and Gateway `00013-gej`
**and their immutable image digests**. It checks Ready, reconciled service state,
100% live traffic (zero-traffic tags are allowed), dedicated identities, chunk
gates, timeout >=180s, CPU/memory/concurrency, Worker tmpfs 384 MiB, max instances 1,
private Worker IAM including Tasks invoker, public-HMAC Gateway mode/secret
reference, canonical Worker routing and the queue retry/rate policy without an
HTTP target override. A future cloud release requires a reviewed pin update;
the gate never moves traffic or relaxes security to make itself pass.

On the VPS, the existing deployment lock covers configuration snapshots,
`.env.next` validation/installation and migrations. Existing pre-migration backup,
disk/inode headroom and immutable image retention still apply. The candidate
image validates readiness evidence for the same SHA (<=30 minutes old), existing
runtime config and noninteractive root/sudo/systemd availability. Missing WIF,
GCP read permissions, evidence, sudo or private approval is a visible blocker.

The normal ledger-based migration runner applies pending migrations once. Before
activation, `verify-pdf-v2` checks ledger 0029 and actual column types/nullability,
including `worker_version` default **1**. A candidate one-shot API process then
uses the unchanged private `approval.json` loader and authenticated Gateway
queue/v2 capabilities checks with the three v2 flags supplied only to that process.
Credentials are never transferred to Actions or printed. No existing job is
upgraded and no migration file is edited.

After normal Web/API health/readiness passes, Actions installs the existing
systemd units idempotently and enables the one-minute timer. Only then it atomically
updates `PDF_API_ENABLED`, `PDF_CHUNKED_JOBS_ENABLED` and
`PDF_LONG_PRINT_TASKS_ENABLED` to `true` in `pdf-runtime/runtime.env`, preserving
all other lines and file permissions. Only API is recreated for this flag change.
It verifies API health, schema/authenticated Gateway, a real successful systemd
recovery invocation, enabled/active timer, public capabilities (`submitEnabled`,
`downloadEnabled`, `maxPages: 200`) and `/tools`. Subsequent deploys repeat the
same gates and retain v2; there is no manual SSH/env/timer/migration activation.

Failure before activation restores application env/images and leaves PDF runtime
unchanged. Failure after flag activation restores runtime/config and previous
images **only when there are no unexpired v2 jobs/results**. If such jobs/results
exist, or their state cannot be read, it fails visibly and keeps compatible API,
v2 flags and recovery for fix-forward. This conservative exception protects
continuation and downloads. It never disables the timer, downgrades Cloud Run,
deletes jobs/checkpoints or rolls back additive schema. Checkpoint/object lifecycle
remains unchanged. Temporary config snapshots/evidence are removed after success.

The readiness artifact is a nonsecret deployment input, retained for one day;
it is not a screenshot or test log. No artifact is committed. Production acceptance
still requires permitted Drive fixtures at 3/35/>50/200 pages, real Tasks dispatch,
10-page progress, ordered merge/download, closed-browser recovery, permission
rejection and v1 compatibility. Missing fixtures must be reported as NOT RUN;
`maxPages: 200` alone never proves these cases.

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
8. The approved rollout is performed by the automated pipeline above. The existing
   private approval file remains mandatory and unchanged; runtime flags are not
   a replacement for that boundary. No secret value belongs in Git or logs.

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
