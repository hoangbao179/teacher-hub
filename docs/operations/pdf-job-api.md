# PDF API operation and activation gates

API and recovery CLI default to DisabledPdfProvider. A PDF_API_ENABLED flag alone
cannot produce cloud calls. The shared private approval loader can now construct
GatewayPdfProvider with explicit OIDC federation and HMAC. No issuer has been
confirmed on the VPS; keep production disabled until the
[activation gates](pdf-vps-activation.md) pass. No ADC, JSON keys, user gcloud or
GitHub verifier credentials are used. The older direct REST provider remains an
explicitly injected alternative, not the production Gateway path.

## Local verification and migration

Use an isolated synthetic MySQL database ending `_test`, never the real classroom
database. No GCP credentials are needed. With DB_HOST/PORT/USER/PASSWORD/NAME set
explicitly to the isolated database server (NAME without `_test` for the runner):

```text
npm run build:shared
npm -w server run typecheck
node --import tsx --test server/src/services/pdf.service.test.ts
node server/scripts/run-integration.cjs src/services/pdf.integration.test.ts
npm run check:ci
npm -w client run test:e2e:public-pdf
```

The integration runner resets its test database for migration recovery; inspect
the target before running. Migration `0027_pdf_jobs.sql` adds only three InnoDB
tables: batches, jobs/outbox and expiring download-ticket hashes. It uses create-if-
absent steps for interrupted DDL recovery. No applied migration is edited or class/
tuition/student data rewritten. Verify schema_migrations, table columns/foreign keys,
unique idempotency indexes and rollback-on-failed-job-insert integration coverage.

Deployment/migration on the VPS is NOT authorized by this task. Before an approved
future rollout: backup/recovery verification and disk headroom, deploy disabled
code, apply the new migration using the existing reviewed process, check capability
disabled and auth gates, then smoke history with synthetic records only.
Old code can ignore these additive tables. Rollback code/flag first and preserve
all job history. Do not drop tables with business records or enqueue intentions;
review data export/retention manually. If migration partially fails, stop rollout,
inspect actual tables and migration ledger, fix forward/re-run the new idempotent
DDL on an approved backup-verified database. Do not edit earlier migrations.

Public batches use migration 0028's existing link table in the same transaction
as batch/job creation; this fix adds no migration or backfill. Link failure must
leave no batch/job and no dispatched task. Public list/detail/retry/download work
across devices without the submission cookie; private admin list/count exclude
public rows. The public browser regression creates its own uniquely named
synthetic `_test` database, migrates it, injects FakeCloud into the router in
process and drops only that newly created database on exit. It never enables
the production runtime. Provide fixture DB host/port/user/password explicitly.
The [proxy boundary](production.md#trusted-proxy-and-client-ip) is part of the
cost-control gate; verify the actual deployed client IP before activation.

## Manual activation prerequisites (not executed)

- Approved independently attested VPS identity, dedicated producer SA, exact issuer/
  audience/subject restrictions, token rotation/revocation and operator-approved
  production wiring. No identity is approved or configured here.
- Producer: tasks.create/tasks.get and queues.get on
  projects/teacher-hub-pdf/locations/asia-southeast1/queues/teacher-pdf-queue;
  actAs on teacher-pdf-invoker SA only; storage.objects.get on
  teacher-hub-pdf-results-2026 only. Prefer custom roles. No object write/delete,
  Run Admin, deploy, IAM mutation or broad project access.
- Cloud Tasks agent has normal service-agent token authority; invoker SA has
  run.invoker on the private worker, IAM invoker check enabled. OIDC audience is
  the exact base URL and target is POST /jobs. Neither headers nor public access
  replace IAM. Readiness verification must include service config and real OIDC.
- Queue must be RUNNING with reviewed rate <=1/s and concurrency 1, maxAttempts=5,
  maxRetryDuration=3600s, minBackoff=10s, maxBackoff=300s, no HTTP target override.
  The adapter reads live queue config before dispatch and caches it for <=60 seconds;
  it never patches the queue. Dispatch deadline is 30 seconds, Worker budget 22.
  Queue retry exhaustion uses both attempt/time evidence, not a missing task.
- Worker processing revision, 32 MiB bounded writable volume, result bucket permissions
  and runtime gates verified per [worker runbook](cloud-run-pdf-worker.md). Storage
  reads/downloads and late/missing/error result reconciliation verified in private
  cloud E2E. Owner approval is the final activation gate. Include an independently
  scheduled reconciler and prove a five-link submit finishes dispatch after the
  HTTP client closes. HTTP/CLI must receive the same reviewed identity through
  createPdfRuntime; programmatic recoveryVerified approval requires this test and
  schedule review. These are integration gates, not flags that mint identity.

No keyless signer has been approved, so this implementation uses authenticated
streaming rather than signed GCS URLs. The streaming path also remains disabled
until the same identity/activation gates pass. No signBlob permission is requested.

## Recovery, resources and cost

When an approved provider is eventually wired, run the bounded one-shot CLI
`node server/dist/scripts/reconcile-pdf.js` from the existing operator mechanism.
It repeatedly processes one due job at a time, across owners/batches, up to
PDF_RECONCILE_MAX_JOBS=50 or PDF_RECONCILE_BUDGET_MS=45000. Overrides must be
integers in 1..50 and 1..45000; invalid values fail without work. It stops early
when idle/unavailable. Output is a sanitized processed count, stop reason and
actual submitEnabled capability; zero while disabled does not prove recovery works.
The run deadline cancels cloud calls; each retains a four-second timeout. A
50-second CLI hard stop also bounds hung DB/driver cleanup. Interrupted leases
are safe to reclaim after 60 seconds; stale owners cannot overwrite later work.

After identity/activation approval and private E2E, the operator must separately
configure the existing trusted scheduler to invoke this command once per minute
inside the existing API runtime, with the same environment and approved identity
loader as HTTP. From the built repository root, the command is:

```text
PDF_RECONCILE_MAX_JOBS=50 PDF_RECONCILE_BUDGET_MS=45000 node server/dist/scripts/reconcile-pdf.js
```

Use the corresponding dist/scripts path if the runtime working directory is
server/. No key files or personal credentials may be mounted. Configure a scheduler
timeout of 55 seconds with a five-second kill grace and sanitized exit/stop-reason
monitoring. Leases protect overlap across processes; optionally use the scheduler's
single-instance lock. Do not enable submissions before the reviewed schedule is
active. The repository provides systemd timer/service templates and Actions copies
them, but operator installation and verification remain required. Current
entrypoints remain disabled without approved federation and explicit
activation/recovery verification. Operator identity wiring is still a blocker.
Each invocation is an additional short-lived Node process, even inside the existing
API container. Benchmark combined API/CLI/MySQL memory and CPU before scheduling
on the shared 1.5 GB/1 vCPU VPS; no combined-production peak was measured here.
Do not increase container limits or VPS resources to enable the schedule silently.

For missing/deleted tasks, keep polling result.json; never infer FAILED or allocate
a new UUID. RESULT_UNCONFIRMED has an explicit wait-until-expiresAt path; before
that time manual retry returns 409. At expiry downloads are denied and a new
successor may be explicitly requested with an idempotency key, subject to the
existing two-retry, one-successor and owner rate/capacity limits. Only validated
Worker results confirm PDF success/failure. RETRY_EXHAUSTED is optional positive
evidence; it also remains pollable so a late durable result can supersede it.
If fresh task metadata contradicts an older exhausted observation, reconciliation
returns RESULT_UNCONFIRMED and disallows an early successor. A live queue-policy
read is required before the REST adapter emits a new exhausted observation.
Manual retry is denied while a reconciliation lease is active. The positive REST
evidence requires matching policy, five completed responses, no dispatched request
still awaiting response, sufficient retry duration and 60 seconds since the last
failed response; absent/incomplete/overridden policy evidence never proves exhaustion.
For queues held beyond the local expiry window, operators must investigate stale
dispatches before authorizing repeated manual work; TTL and attempt caps are not a
distributed cancellation of a Cloud Tasks delivery or an in-flight Worker request.

Runtime defaults: PDF_BATCH_LIMIT=5 (ceiling 5), PDF_ACTIVE_LIMIT=10 (ceiling 20),
PDF_HOURLY_LIMIT=10 (ceiling 30). Invalid settings fail closed. Manual retries max
two; rate includes retry job creations. Tickets capped at 20 per owner and cleaned
when issuing another; only expired authorization rows are deleted, never history.

No qpdf/Chromium/rendering, PDF buffer/file, image layer or new container is added to
the VPS. Streaming uses backpressure with one download/process and a 10 MiB byte
bound; memory scales with chunks/socket buffers, not entire PDF. No production
RAM/CPU benchmark has been performed. MySQL adds bounded-width rows/indexes and
short transactions. At maximum default hourly usage 1200 new jobs/day is possible;
budget several KiB/job including indexes plus batch rows, backups, binlogs and
logs. This is an estimate, not measured allocation. History has no automatic purge;
monitor growth against the shared 15 GB disk and review archival/retention before
sustained use. Read polling costs, Tasks requests, GCS reads/egress and identity
issuer/broker costs need an actual workload estimate. VPS resources remain unchanged.

Audit logs must never contain tickets, tokens, source URLs, file content or provider
error payloads. Cloud transport errors are sanitized. qpdf is not antivirus;
downloads remain attachment/nosniff. No cloud E2E or production resource claim is made.

## PDF VPS integration

See [private Gateway activation](pdf-vps-activation.md) for IAM + HMAC, host-owned secret configuration, outbound API networking, the one-minute systemd recovery timer and rollback. PDF stays disabled until the existing-issuer and live recovery gates pass; no new VPS container or resource increase is introduced.
