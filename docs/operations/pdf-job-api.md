# PDF API operation and activation gates

No cloud/VPS/config/secret/deployment change is performed by Task 2. Current API
and recovery CLI use DisabledPdfProvider. Even a true PDF_API_ENABLED flag cannot
produce cloud calls. Do not wire a credential provider or expose downloads until
the [identity ADR](../decisions/ADR-pdf-producer-identity.md) is approved and verified.
The REST adapter accepts only an explicitly verified external-workload token
supplier; it never loads ADC, JSON keys, user gcloud or GitHub WIF credentials.

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
  cloud E2E. Owner approval is the final activation gate.

No keyless signer has been approved, so this implementation uses authenticated
streaming rather than signed GCS URLs. The streaming path also remains disabled
until the same identity/activation gates pass. No signBlob permission is requested.

## Recovery, resources and cost

When an approved provider is eventually wired, run the bounded one-shot CLI
`node server/dist/scripts/reconcile-pdf.js` from the existing operator mechanism.
It processes at most three due jobs then exits. In current source it reports zero
and submitEnabled=false; it cannot recover production cloud jobs yet. Request
polling uses the same leases; 60-second abandoned leases recover after restart.
If operators want unattended recovery, approve wiring/scheduling separately;
this task adds no timer/daemon/container or CI deployment change.

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
