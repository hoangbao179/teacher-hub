# PDF on tienganhcovy.com — private Gateway activation (option A)

For the separately approved **option B (public HTTPS Gateway + HMAC, private Worker)**,
see [the public-HMAC operator runbook](pdf-vps-hmac-public.md). No Cloud Run
authentication setting or PDF API is changed merely by merging that code.

Source integration for option A is complete; activation is **blocked by the absence of a
confirmed VPS OIDC issuer**. Do not redeploy the existing Google Cloud services.
The owner reports Worker `teacher-pdf-worker-00003-6m4` and Gateway
`teacher-pdf-gateway-00003-s6v` at 100% traffic, real Tasks → PDF and
HMAC → nonce → Tasks PASS. Those results do not establish VPS IAM authentication.

## Identity boundary

The Gateway requires **both** Google Cloud Run IAM and HMAC. The API reads a
private, explicitly approved OIDC federation configuration; exchanges an issuer
JWT through Google STS; calls IAM Credentials `generateIdToken` with the exact
Gateway audience; then sends `Authorization: Bearer` alongside the HMAC headers.
Google validates the issuer JWT and the resulting ID token. The decoded token
claims in our code are additional guards, not a replacement signature verifier.
Tokens stay in process memory, are refreshed one minute before expiry, and all
transport diagnostics are sanitized. Missing/expired issuer token, invalid
configuration or denied IAM returns unavailable; no HMAC-only fallback exists.

No ADC, personal gcloud refresh credentials, service-account JSON key, GitHub
verifier identity or self-signed VPS JWT is used. The owner must identify an
**existing trusted issuer that independently authenticates this VPS** and renews
its JWT atomically at `/opt/teacher-hub/pdf-runtime/subject.jwt` before expiry.
If none exists, keep PDF disabled. Creating an issuer/service or changing the
architecture requires a separate operator decision, including cost. Scheduled
GitHub token delivery is not a reliable substitute for VPS workload identity.

Once an issuer exists, restrict the WIF provider to its exact issuer, audience and
VPS subject. Use a dedicated Gateway caller SA with service-scoped `run.invoker`
only, and bind `roles/iam.workloadIdentityUser` on that SA only to the exact WIF
subject. This caller needs no Tasks, GCS, deployment or IAM mutation permissions.
Inspect existing bindings first; do not repeat Worker/Gateway IAM already verified.
Operator-only templates (replace approved identifiers; no secret values):

```bash
gcloud iam service-accounts add-iam-policy-binding "$CALLER_SA" \
  --project=teacher-hub-pdf --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/projects/851777150171/locations/global/workloadIdentityPools/$POOL/subject/$VPS_SUBJECT"
gcloud run services add-iam-policy-binding teacher-pdf-gateway \
  --project=teacher-hub-pdf --region=asia-southeast1 \
  --role=roles/run.invoker --member="serviceAccount:$CALLER_SA"
```

Do not run these until the issuer/provider and exact subject have been reviewed.
Provider creation cannot be specified safely without those real values. See
[Google's external federation flow](https://docs.cloud.google.com/run/docs/authenticating/service-to-service#use-workload-identity-federation-from-outside-google-cloud).

## Host configuration and deployment

Docker Compose >=2.24 is required for optional `env_file`. Deployment Actions copy
the recovery script/unit templates but **never** transmit PDF credentials, install
the timer or enable PDF. Host-owned `pdf-runtime/` survives image deployments and
is excluded from Git and Docker context. Do not print `docker compose config`
without `--quiet`, dump container environment or enable shell tracing.

API joins a separate bridge for outbound HTTPS to Google; MySQL stays on the
internal backend network. No inbound API port is published, Caddy/Nginx routing
and `PUBLIC_APP_ORIGIN=https://tienganhcovy.com` remain unchanged.

Create the host directory root-owned mode 0755. Secret JSON/JWT files must be
mode 0600, owned by container node UID 1000 (verify image UID before provision).
The host root renewer writes a temporary file, sets ownership/mode and renames it
atomically in this directory. The whole directory is mounted read-only so token
rotation is visible without restarting API. Never put secrets in commands/history.

`runtime.env` contains only nonsecret feature settings:

```dotenv
PDF_API_ENABLED=false
PDF_BATCH_LIMIT=5
PDF_ACTIVE_LIMIT=10
PDF_HOURLY_LIMIT=10
```

Approval JSON schema (placeholders, **not** a usable credential):

```json
{
  "kind": "pdf_gateway_v1",
  "gatewayURL": "https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app",
  "workerBaseURL": "https://teacher-pdf-worker-851777150171.asia-southeast1.run.app",
  "hmacKeyHex": "<existing secret provisioned securely, 64 lowercase hex characters>",
  "federation": {
    "audience": "//iam.googleapis.com/projects/851777150171/locations/global/workloadIdentityPools/<approved-pool>/providers/<approved-provider>",
    "serviceAccount": "<dedicated-caller>@teacher-hub-pdf.iam.gserviceaccount.com",
    "subjectTokenFile": "/run/teacher-pdf/subject.jwt"
  },
  "activationApproved": true,
  "recoveryVerified": true
}
```

These booleans are operator attestations, not automatic evidence. Old HMAC-only
approval files are intentionally rejected. For private rehearsal use a distinct
`rehearsal.json`, injected only into a controlled CLI process; leave
`approval.json` absent and public `PDF_API_ENABLED=false`. Promote to
`approval.json` only after the following checks. Do not falsely mark production
recovery verified based on the disabled timer's idle output.

Deploy the reviewed immutable SHA using the existing deployment script, after
recording the current SHA and saving the previous Compose/script set:

```bash
cd /opt/teacher-hub
./deploy-production.sh <REVIEWED_FULL_COMMIT_SHA>
sudo install -m 644 teacher-pdf-recovery.service teacher-pdf-recovery.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now teacher-pdf-recovery.timer
systemctl list-timers teacher-pdf-recovery.timer
```

The deployment script backs up DB before migrations. Migrations `0027` and `0028`
already cover jobs/outbox/tickets/public history; no new migration is needed.
Verify `schema_migrations` includes both and that existing classroom data remains
unchanged. Do not rerun applied SQL manually or restore a production dump for tests.

## Private rehearsal and activation gates

Use the same API image and a disposable database with a synthetic teacher for
private end-to-end rehearsal. Inject `PDF_API_ENABLED=true` and the rehearsal
approval path **only into that test process**, never the public API container.
Use an owner-authorized, public direct-download Drive PDF <=20 MiB. The local
fixture suites use fake cloud services and cannot prove real cloud connectivity.

1. Confirm correct IAM + HMAC reaches `/v1/queue`; IAM-only, HMAC-only, expired
   tokens, wrong audience, replayed nonce and wrong HMAC must be denied. Confirm
   issuer renewal works across at least one ID-token refresh.
2. Submit a five-link batch, close its browser, observe deterministic Cloud Tasks,
   Worker terminal result and GCS object. Drive unsupported/restricted/error cases
   must become the documented status without leaking source/token diagnostics.
3. Run the independent scheduler against that rehearsal database with the same
   CLI/runtime (temporary systemd override, then remove it). Require recovery of
   pending jobs across multiple timer invocations with no browser open. Test
   Gateway interruption then restoration and observe outbox recovery. Do not count
   a disabled idle tick as success. Enabled-but-unavailable CLI exits nonzero.
4. Open public history on a second device/context, acquire a fresh single-use
   ticket, download and compare bytes/hash. Verify interrupted downloads require
   a new ticket. Check expiry boundary with a controlled test clock/fixture and a
   real 24-hour retained job; never alter production clock/DB timestamps.
5. Measure API + recovery peak RSS/CPU, disk growth and request costs on the VPS.
   Recovery runs inside API's existing 384 MiB cgroup, Node heap capped at 64 MiB,
   at most 50 jobs/45s, hard exit 50s and host timeout 55s. Heap is not total RSS;
   headroom is not proven by local tests. Keep existing resource limits.

Only after operator acceptance, provision `approval.json`, change host
`runtime.env` to `PDF_API_ENABLED=true`, then:

```bash
cd /opt/teacher-hub
docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-deps api
sudo systemctl start teacher-pdf-recovery.service
systemctl status teacher-pdf-recovery.timer teacher-pdf-recovery.service
curl --fail --silent https://tienganhcovy.com/api/public/pdf/capabilities
```

Verify capabilities, one approved public job, download on another device and
`journalctl -u teacher-pdf-recovery.service` summaries. Logs must contain only
counts/states, never source links, JWTs, tickets or secret payloads.

## Rollback

First set `PDF_API_ENABLED=false` in host `pdf-runtime/runtime.env` and recreate
API with the `up -d --no-deps api` command above; verify capabilities unavailable.
Stop the timer if identity is compromised or code must be rolled back:

```bash
sudo systemctl disable --now teacher-pdf-recovery.timer
sudo systemctl stop teacher-pdf-recovery.service
cd /opt/teacher-hub
./deploy-production.sh <PREVIOUS_FULL_COMMIT_SHA>
```

For a deployment-file regression restore the saved Compose/script set before the
last command. PDF runtime config is host-owned and must remain disabled during
rollback; image rollback alone does not reset it. Preserve job history, queue and
bucket results; no database down migration or data deletion. Investigate pending
jobs before restoring the timer. Revoke the specific caller binding and rotate
HMAC through the existing secret process if compromise is suspected. No Cloud Run
redeploy/traffic switch is needed for normal VPS code rollback.
