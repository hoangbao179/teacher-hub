# PDF on tienganhcovy.com — option B: HTTPS Gateway + HMAC

**Status: code-only review. Not live or approved.** The existing production
Worker and Gateway Cloud Run revisions stay unchanged; this PR does not disable
IAM, expose a URL, transmit a secret, deploy the VPS, enable PDF, or start the
recovery timer. Use this only after a security/operational review.

## Scope and trust boundary

- Only `teacher-pdf-gateway` would be callable over public HTTPS without a
  Cloud Run Invoker IAM check. **Worker remains IAM-private** and is invoked
  exclusively by Cloud Tasks using the existing dedicated invoker identity.
- The Cloud Run Gateway application still requires HMAC-SHA256 over exact
  method, path, timestamp (60-second window), nonce and SHA256(raw body).
  Requests lacking a valid signature are denied *before* Cloud Tasks/GCS calls.
  Nonces are atomically reserved in GCS; replay is denied across instances.
- Backend `GatewayPdfProvider` opts into `hmac_public_v1` **only via an exact
  approved private file**, never based on a failed token exchange or environment
  boolean. The existing private IAM + HMAC file contract continues to work.
- No HMAC or approval document may be exposed to the browser, logs, Git,
  Docker image, GitHub Actions, or command history. HTTPS is mandatory.
- **Significant tradeoff:** disabling Cloud Run IAM allows *anyone* to send
  network requests to the Gateway, including abusive/unsigned requests that
  can incur Cloud Run charges. HMAC is application authentication, not DDoS
  protection. A single-instance token bucket is not a global quota. Review
  Cloud Run max instances (1), rate limits, billing alerts, abuse monitoring,
  and whether a WAF/load balancer is required. No spending-limit guarantee.

## Sequence: do not skip gates

1. Review this PR, test suites and current Cloud Run Gateway HMAC implementation.
   Confirm `/v1/*` rejects missing/invalid HMAC without contacting GCS/Tasks;
   replay, stale timestamp, wrong body/path, malformed task and overflow tests
   pass. Check secret rotation/revocation procedure and nonce lifecycle: objects
   must remain at least the full HMAC replay/timestamp window. Verify Gateway
   IAM scopes remain least-privilege and Worker IAM remains enabled.
2. Merge/deploy backend code with the public PDF flag **disabled** and without
   an `approval.json` file. Verify old website features and API availability.
   Preserve existing MySQL data, migration state and rollback image SHA.
3. After explicit owner approval for the changed public attack surface, change
   **only the Gateway** to public HTTPS using Cloud Run's documented control:
   
   ```bash
   gcloud run services update teacher-pdf-gateway \
     --project=teacher-hub-pdf --region=asia-southeast1 \
     --no-invoker-iam-check
   ```
   
   Do not change `teacher-pdf-worker`, project IAM, GCS bucket policies, or
   queue privileges. Check the Gateway has `ingress=all` as already configured,
   and verify only Gateway IAM checking is disabled. An unsigned
   `GET /v1/queue` must return **401** (application HMAC rejection), and
   `/health` may return 200; a 200 on unsigned `/v1/queue` is a STOP condition.
   Test signed HMAC via a trusted server-side operator script, never a browser.
4. On the VPS, use the existing host-owned read-only
   `/opt/teacher-hub/pdf-runtime/` volume with ownership/permissions as in
   `pdf-vps-activation.md`. The nonsecret `runtime.env` remains
   `PDF_API_ENABLED=false` during rehearsal. Do not create `approval.json`
   until independent recovery, controlled Cloud E2E and owner acceptance pass.
   For a controlled isolated rehearsal, use a separate 0600 `rehearsal.json`
   and a disposable test database, not the production API process.
   
   Public-HMAC configuration schema **(placeholders only, not usable secrets)**:
   
   ```json
   {
     "kind": "pdf_gateway_v1",
     "gatewayURL": "https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app",
     "workerBaseURL": "https://teacher-pdf-worker-851777150171.asia-southeast1.run.app",
     "hmacKeyHex": "<64 lowercase hex characters; provision from existing Secret Manager via approved secure transfer>",
     "authMode": "hmac_public_v1",
     "activationApproved": true,
     "recoveryVerified": true
   }
   ```
   
   Exactly these seven keys are accepted; `federation`, `subjectTokenFile`,
   user-supplied gateway URLs, API keys and service-account JSON keys are
   prohibited. Approval flags attest operator review; they are not evidence.
5. In the isolated rehearsal, confirm HMAC-only GET queue, enqueue, Worker OIDC,
   result.json, authorized PDF download and one-use ticket. Check five links,
   browser closed, retry/replay, cross-device download, 24-hour expiry and VPS
   resource/cost headroom. Install/test the existing systemd timer with enabled
   isolated recovery state before marking `recoveryVerified=true`. A disabled
   or idle CLI does **not** prove recovery works.
6. After successful review, create host-owned production `approval.json` mode
   0600, set `PDF_API_ENABLED=true` in host `runtime.env`, recreate **API
   only** via existing Compose, enable/start
   `teacher-pdf-recovery.timer`, then check
   `https://tienganhcovy.com/api/public/pdf/capabilities` and one authorized
   real end-to-end PDF on a second device. Watch sanitized recovery logs,
   Cloud Run request rates, Cloud Tasks queue, GCS and billing. Do not enable
   the flag before the timer and secret/permissions are ready.

## Emergency rollback

First set `PDF_API_ENABLED=false`, recreate only the API, and stop the PDF
recovery timer. Re-enable Gateway IAM immediately if unexpected abuse or a
credential compromise is suspected:

```bash
gcloud run services update teacher-pdf-gateway \
  --project=teacher-hub-pdf --region=asia-southeast1 \
  --invoker-iam-check
```

Do not make Worker public or delete jobs/results. Re-enable Cloud Run IAM
**before** trusting that exposed credentials or stale HMAC signatures have
been contained; rotate/revoke the shared HMAC secret through the existing
reviewed process if compromised. Roll back VPS API image to its recorded
previous SHA if the code itself regresses. See `pdf-vps-activation.md`
for Compose/timer details.

## CI / proof boundary

Node unit tests exercise the exact public-HMAC approval contract and signed
outbound requests. Existing Gateway tests cover signature/nonce/rate limits.
PR CI and FakeCloud are not evidence of real public Gateway abuse resistance,
billing limits, remote IAM policy, or a real VPS-originated E2E. Those remain
operator-controlled gates.
