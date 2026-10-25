# PDF Gateway - IAM + HMAC (option A) or explicit public HMAC (option B)

The optional public-HMAC integration is documented in
[pdf-vps-hmac-public.md](pdf-vps-hmac-public.md). It is **not** enabled by source
deployment; Cloud Run IAM remains on unless an operator deliberately changes the
Gateway service setting after security review. The Worker always remains private.

The existing Cloud Run Gateway serves the VPS integration. Operator reports private cloud processing PASS; website activation remains blocked. See [VPS activation](pdf-vps-activation.md) for the current IAM flow, host configuration, rehearsal, timer and rollback. It accepts HMAC-SHA256 signed requests (timestamp, nonce, method, path, raw body) and calls only explicitly allowlisted Cloud Tasks and GCS endpoints with its own workload identity. Worker remains private; API/CLI use a shared file-only approval loader and remain disabled until explicit operator provisioning.

### Threat model and outstanding gates

- Shared HMAC secret is not attested VPS identity. Protect/rotate it through a secret manager and a VPS root-owned secret, never git, browser, image or logs.
- Gateway now reserves each nonce with an atomic ifGenerationMatch=0 upload to the existing private GCS bucket under gateway-nonces/ before upstream operations. Concurrent instances/restarts cannot reuse the nonce while the reservation object exists. Ensure a lifecycle policy retains nonce objects for at least the full permitted timestamp/retry window, including clock skew. This adds a GCS write for every authenticated request; cost, rate and IAM scope require verification. On GCS write failure the Gateway fails closed. Concurrency and token-bucket admission are local per instance; still require deployment-level constraints and abuse monitoring.
- Configure a dedicated gateway service account with only tasks.create/get, queues.get on the exact queue, objects.get on the exact bucket and objects.create limited to gateway-nonces/ prefix, and actAs for the fixed Cloud Tasks invoker service account. Do not assign Object Admin, Run Admin, IAM Admin or service account keys.
- Private worker keeps exact service-scoped run.invoker permissions. Google service agent requires standard OIDC token minting. Never expose a public worker endpoint without IAM.
- Use immutable Cloud Run image digest, constrained CPU/RAM and max-instances=1. Min-instances=0 reduces idle costs. Gateway HTTP endpoint must require valid HMAC; do not assume Cloud Run ingress alone authenticates it.
- Restrict caller egress and logs, monitor abuse and bound replay, rate and request sizes before activating public API. Reject Google API errors without leaking diagnostics.
- Gateway uses fixed route paths: GET /v1/queue, POST /v1/tasks, GET /v1/tasks/:jobId, GET /v1/objects/:jobId/request.json|result.json|output.pdf.

### Preparation and tests

Run node --test workers/pdf-gateway/server.test.mjs. Build workers/pdf-gateway image only on approved operator workstation after independent review. No deployment/IAM command is included or authorized here.

### Activation sequence

1. Verify shared GCS nonce reservation and lifecycle, secret management, rate limits, client contract and idempotent transport; verify offline tests and real IAM separately.
2. Deploy dedicated Gateway service only with operator approval, verify invalid/valid HMAC and actual Google Task/GCS permissions.
3. Verify the shared file-only runtime bootstrap in public/admin HTTP and recovery CLI, provision its private configuration only after all approval gates. Without a valid file, createPdfRuntime() continues to use DisabledPdfProvider; feature flag alone never enables it.
4. Verify independently scheduled reconciliation, real Drive PDF fixture, 24h expiry, cross-device public download, rate limiting and incident rollback before enabling public submissions.

### Rollback

Disable producer first; revoke the shared secret, stop gateway dispatch and scheduler; preserve committed MySQL intents and immutable bucket data for bounded reconciliation. Keep the Worker private and do not delete queue/bucket. No infrastructure or database changes are performed by this source-only phase.

### Shared bootstrap (HTTP + CLI)

Both `server/src/container.ts`, `server/src/public-pdf-container.ts` and `server/src/scripts/reconcile-pdf.ts` use `loadApprovedPdfGateway()`. In absence of a review-approved file, all keep `DisabledPdfProvider`. The environment variable `PDF_GATEWAY_APPROVAL_FILE` is an absolute path to a private (Linux mode 0600) local JSON document containing EXACTLY `kind: "pdf_gateway_v1"`, `gatewayURL`, `workerBaseURL`, `hmacKeyHex`, `activationApproved: true`, and `recoveryVerified: true`, plus the exact `federation` object documented in the activation runbook. **Do not provision production `approval.json` before all production gates are satisfied**; private rehearsal uses a separate file injected only into a controlled test process as described in the activation runbook; this is operator attestation, NOT automatic verification. Secrets must never appear in shell history, images, Git, logs or client data. File provision/rotation and per-host ownership must be reviewed before deployment.

For option B, replace `federation` with exactly `authMode: "hmac_public_v1"` as
documented in the [public-HMAC schema](pdf-vps-hmac-public.md). URL/key fields must
be JSON strings without surrounding whitespace; arrays are not coerced. An empty
IAM supplier token fails before a signed network request can be sent.

### Status and caveats

- Gateway uses `pipeline` to stop streaming on client disconnect or deadline, and caps one active download per process. Token buckets limit local rates per instance; actual global rate limits still depend on Cloud Run instance count and infrastructure controls.
- Gateway reserves nonces in GCS as atomic create-only objects. The bucket needs a reviewed least-privilege gateway binding including `storage.objects.create`. The repository cannot prove prefix-scope enforcement, effective IAM or object lifecycle policy; inspect them live before grant/activation. Using a shared bucket for nonce objects affects retention and billing.
- Distinct status `TASK_ALREADY_EXISTS` is only emitted for an upstream duplicate Cloud Tasks creation. Replayed nonce is 401 and cannot be interpreted as successful dispatch.
- Preflight now fails closed when latest traffic revision, resource limits or exact direct invoker principal are not evidenced. Effective/inherited IAM and Gateway permissions require a separate operator assessment.
- CI tests are fixture-only and cannot establish that any Cloud Run identity, GCS lifecycle, scheduler, or actual PDF conversion works in production.

### Cloud Tasks duplicate responses

The Gateway returns TASK_ALREADY_EXISTS only if Cloud Tasks responds with HTTP 409 and the Google error details identify ALREADY_EXISTS (code 409). All other 409 responses fail closed as 503 and cannot be treated by the producer as successful enqueue. Unit tests cover this transport boundary; verify Cloud Tasks behavior with a controlled task in approved cloud E2E.

### Private staging helper

The operator-only [one-shot private rollout](pdf-cloud-rollout.md) stages immutable Worker and Gateway revisions with no traffic transfer; existing private services and Secret Manager IAM must be verified first. Staging does not make Gateway publicly callable by VPS, grant permissions, provision secrets, modify traffic or enable PDF submissions. Live authentication, Tasks and GCS E2E remain activation gates.
