# Cloud Run PDF worker foundation

## Scope and target

This is deployment preparation for an isolated **health-only** service. No cloud
deployment or IAM mutation is part of this preparation task. No renderer,
Chromium, job submission, batch processing, 100-page PDF, queue consumer, storage
integration or VPS API change is included. The [PoC](../features/pdf-quality-poc.md)
remains a local experiment; it is not imported into the worker.

| Resource | Target supplied by owner; existence/IAM not verified here |
| --- | --- |
| Project / region | `teacher-hub-pdf` / `asia-southeast1` |
| Artifact Registry | `teacher-pdf` |
| Cloud Run service (proposed name) | `teacher-pdf-worker` |
| Runtime identity | `teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com` |
| Deployer identity | `teacher-pdf-deployer@teacher-hub-pdf.iam.gserviceaccount.com` |
| Future caller identity | `teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com` |
| Future results bucket | `teacher-hub-pdf-results-2026` (unused) |
| Future queue | `teacher-pdf-queue` (unused) |

The image uses Node 24.18.0, no npm dependencies, a non-root user and an allowlisted
build context limited to the worker source. It listens on `0.0.0.0:$PORT` (8080
default), returns `200 {"status":"ok"}` for `GET /health`, supports `HEAD /health`,
returns 404 elsewhere, and drains on SIGTERM with an eight-second shutdown bound.
Health means process liveness only; it does not test Storage, Tasks or PDF readiness.
IAM authentication is enforced at Cloud Run, not by application JWT parsing.
Local execution has no authentication and must not be exposed publicly.

Target: **1 vCPU / 2 GiB / concurrency 1 / min 0 / max 3**, request-based CPU
allocation, CPU boost disabled, 30-second request timeout, startup HTTP health
probe. Both service and revision scaling limits are set explicitly. Ingress is
`all` to permit authenticated external calls; IAM invoker checking remains enabled,
and unauthenticated invocation is disabled. The script refuses public service IAM
bindings before updating an existing service and checks again after deployment.
Inherited project/folder IAM must also be reviewed by the operator.

## IAM prerequisites and unresolved permissions

The supplied resource/account names and GitHub Variables do **not** prove any
bindings exist. No GCP credentials or IAM inventory was inspected here, so the
following are **required, pending verification**, not confirmed missing grants.
An authorized operator must compare actual policies and grant only the missing
permissions; this workflow neither enables APIs nor creates IAM bindings.

| Principal | Scope and required permission/role |
| --- | --- |
| Approved GitHub WIF principal | `roles/iam.workloadIdentityUser` on the deployer SA |
| Deployer SA | `roles/artifactregistry.writer` on repository `teacher-pdf` (push and read image digest) |
| Deployer SA | `roles/run.developer` on the dedicated project; existing-service update/get and getIamPolicy, no setIamPolicy |
| Deployer SA | `roles/iam.serviceAccountUser` on the runtime SA only (`iam.serviceAccounts.actAs`) |
| Cloud Run service agent | Google-managed `roles/run.serviceAgent`; same-project image pull relies on this service agent, not runtime Storage privileges |
| Runtime SA | No application data roles required for health-only; do not add Storage/Tasks/Admin roles now |
| Invoker SA | After first deploy, `roles/run.invoker` on this service only, granted by an authorized operator |
| Human smoke tester | `roles/iam.serviceAccountOpenIdTokenCreator` on invoker SA to mint an ID token for testing; do not give deployer runtime invocation merely to test health |

Application deployment preserves IAM and requires an existing private service. The
old --no-allow-unauthenticated path requests an IAM policy write (setIamPolicy),
which Run Developer does not provide. It is removed together with IAM-check mutation;
pre/post checks now reject disabled invoker checking, public bindings and read errors.
Operator bootstrap/configuration needs setIamPolicy separately; never grant Run Admin
to the application deployer to repair this. No Owner/Editor grant is required. WIF SA impersonation uses Workload Identity User; no JSON key is needed.

Verify billing and APIs: `run.googleapis.com`, `artifactregistry.googleapis.com`,
`iam.googleapis.com`, `iamcredentials.googleapis.com`, `sts.googleapis.com`.
Cloud Build is unused (Docker builds on the GitHub runner). Storage/Tasks APIs and
data roles are not needed for health-only.

For a later queue integration, separately review task producer `roles/cloudtasks.enqueuer`
on the queue and `iam.serviceAccounts.actAs` on invoker SA, Cloud Tasks service
agent `roles/cloudtasks.serviceAgent` for OIDC tokens, service-scoped invoker binding,
and runtime bucket object permissions/retention. Do not activate any of these flows
now; the worker has no task handler and POST requests return 404.

## WIF trust and GitHub setup

Use the existing repository Variables `GCP_PROJECT_ID`, `GCP_REGION`,
`GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`. Provider must be the full
`projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`
resource name, using the numeric project number. No credential secret is required.
The workflow validates the exact project, region and deployer before authentication.

Before any run, configure GitHub environment **`pdf-worker`** with required reviewers,
prevent self-review where supported, disable admin bypass, and allow only `main` via a custom branch policy. The workflow reads these settings before WIF and fails closed on missing protection or read denial. Merely declaring an
environment in YAML does not enforce approval: GitHub may create an unprotected
environment. If the plan cannot enforce reviewers, this workflow stays blocked. Use an independently approved operator-run deployment with credentials inaccessible to GitHub, or upgrade the plan; a typed confirmation alone is not equivalent approval.

Provider issuer must be `https://token.actions.githubusercontent.com`. Restrict the
provider attribute condition to this repository's **numeric repository ID and
numeric owner ID** (operator obtains them from GitHub), `assertion.ref == 'refs/heads/main'`,
`assertion.event_name == 'workflow_dispatch'` and
`assertion.workflow_ref == 'hoangbao179/teacher-hub/.github/workflows/pdf-worker.yml@refs/heads/main'`.
Map claims used in principalSet bindings explicitly; check the actual provider
mapping before changing it. Do not trust a shared pool unrestricted or rely solely
on mutable repository/owner names. With a GitHub environment, the default OIDC
subject is `repo:hoangbao179/teacher-hub:environment:pdf-worker`, **not** the
branch subject. Restrict branch via the provider condition and GitHub environment.
Check whether custom OIDC subject templates are configured before granting a subject.

## Verification and deliberate deployment sequence

Local checks require no cloud authentication, MySQL or browser:

```bash
npm --prefix workers/pdf run check
npm --prefix workers/pdf test
bash -n scripts/deploy-pdf-worker.sh
bash scripts/deploy-pdf-worker.test.sh
```

The Bash test replaces **all** gcloud/docker calls with mocks. It checks guards,
public IAM rejection, failures and the deployment command; it is not a cloud dry
run. Optional local Linux container verification: build `workers/pdf/Dockerfile`
with context `workers/pdf`, run with 1 CPU/2 GiB, probe health/404 and send SIGTERM.
The deploy workflow performs these container checks before pushing anything.

1. Review/merge the source separately. GitHub requires a dispatch workflow to exist
   on the default branch; this workflow additionally rejects refs other than main.
   Merging into main still invokes the existing VPS CI/deployment behavior. Plan
   and approve that existing effect separately; this task does not merge or push.
2. After trust/environment review, select Actions → `pdf-worker-manual` → Run
   workflow → branch `main` → mode **`verify-wif`**. Leave confirmation empty.
   This runs offline tests, exchanges OIDC for a deployer token without printing it,
   and reads Artifact Registry metadata. It **does not build/push an image, create
   a revision, change IAM, invoke Cloud Run or enqueue tasks**. Token exchange may
   produce audit logs; generated auth files are ephemeral runner files, never artifacts.
3. WIF PASS proves token exchange/SA impersonation and repository read only.
   403 at token exchange suggests provider claims, audience or Workload Identity User;
   403 on repository read suggests repository IAM/API. Inspect sanitized errors,
   never print JWT/access tokens or credential files. Compare actual IAM policies
   against the table; write/deploy/actAs permissions remain unproven.
4. Owner approves IAM scope, authentication, resource/cost budget, environment
   reviewers, image retention and rollback before the **first** deployment.
5. An authorized operator must first bootstrap the reviewed health image as a private service, enable IAM invoker checking, remove public service AND inherited grants, and grant only the invoker SA. This is a separate approved operation; the application workflow refuses a missing service. Only then dispatch mode **`deploy`**, confirmation **`deploy-health-only`**.
   It builds on the runner, smoke-tests the image with Linux/amd64 and the stated
   resource caps, pushes a full-SHA tag, resolves its immutable digest and deploys
   that digest. No `latest` tag or VPS workflow changes. A failed postcheck is a
   failed deployment verification even if Cloud Run already accepted the revision.
6. An operator reviews the resulting service config/IAM, grants the invoker binding,
   and verifies anonymous denial plus authorized health invocation. No task dispatch.

Post-deployment smoke commands for the authorized operator (not run in preparation):

```bash
WORKER_URL=$(gcloud run services describe teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --format='value(status.url)')
# Expect 401/403; a 200 is a security failure.
curl -sS -o /dev/null -w '%{http_code}\n' "$WORKER_URL/health"
# Disable shell tracing; never print or persist this token.
set +x
TOKEN=$(gcloud auth print-identity-token --impersonate-service-account=teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com --audiences="$WORKER_URL")
curl --fail --silent --show-error -H "Authorization: Bearer $TOKEN" "$WORKER_URL/health"
unset TOKEN
```

Expected authorized result: `200 {"status":"ok"}`; token audience is the service
base URL, without `/health`. Confirm authorized POST `/jobs` returns 404. Capture
only sanitized status/config evidence under ignored `.artifacts/`, never tokens.

## Cost, retention, rollback and remaining gates

No cloud resources are created by local checks. Future deployment uses separately
billed Cloud Run, Artifact Registry image/layer storage, logs and network; future
Storage/Tasks add their own storage/operation costs. No Cloud Build charge is planned.
Min 0 permits scale to zero; it does not promise zero billing. At configured max 3,
the nominal active allocation is 3 vCPU / 6 GiB; Cloud Run can temporarily exceed
instance limits during spikes/maintenance, so max instances is not a spending cap.
Approve a budget/alerts and workload estimate against current regional pricing
before deploying; no usage-based monthly estimate or production sizing is proven.
The VPS 1.5 GB/1 vCPU/15 GB budget remains separate and unchanged.

Before deploy, record current revision, traffic split, image digest and IAM/config.
For later revisions, an operator can restore traffic using `gcloud run services
update-traffic teacher-pdf-worker --to-revisions=PREVIOUS_REVISION=100` with the
same project/region. Traffic rollback does not restore service-level scaling or IAM;
restore the reviewed previous settings explicitly. For a first-deploy failure,
there is no prior revision: an operator must approve removal of the health-only
service. No automatic destructive rollback or IAM repair is implemented.

Full-SHA tags accumulate; approve an Artifact Registry cleanup policy retaining
active/rollback digests before repeated deployment. Account for compressed images,
layers, revisions, runner build cache and logs. Do not store PDFs or create bucket
lifecycle rules in this step. Linux container smoke, WIF, real service IAM/health,
regional quota and billing still require verification on the target infrastructure.
PDF handling needs a new design/security/resource review and authorized fixtures;
this foundation is not production approval for the PoC pipeline.

## First bootstrap: operator only, after explicit approval

These commands are a manual runbook, not a script invoked by CI. Use a reviewed,
clean checkout and an operator identity approved for service creation/update,
`run.services.getIamPolicy`/`setIamPolicy`, repository push and actAs on the runtime
SA. Those bootstrap permissions belong to the operator, not the deployer. Confirm
the project has billing/APIs enabled, the repository exists and service is absent.
A permission/network error is not evidence of absence; stop and resolve it first.
Review ancestor IAM for public invoker grants before creating the service.

In Bash on an approved workstation with Linux Docker and gcloud, first build/test:

```bash
set -euo pipefail
test -z "$(git status --porcelain)"
BOOTSTRAP_SHA=$(git rev-parse HEAD)
IMAGE="asia-southeast1-docker.pkg.dev/teacher-hub-pdf/teacher-pdf/teacher-pdf-worker:$BOOTSTRAP_SHA"
npm --prefix workers/pdf test
docker build --pull --platform linux/amd64 -t "$IMAGE" workers/pdf
docker run -d --name pdf-bootstrap-smoke --cpus=1 --memory=2g --memory-swap=2g \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges "$IMAGE"
docker exec pdf-bootstrap-smoke node --input-type=module -e 'const r=await fetch("http://localhost:8080/health"); if(r.status!==200 || (await r.json()).status!=="ok")process.exit(1)'
docker stop --time=10 pdf-bootstrap-smoke
test "$(docker inspect --format='{{.State.ExitCode}}' pdf-bootstrap-smoke)" = 0
docker rm pdf-bootstrap-smoke
```

If the container/probe fails, stop; inspect sanitized errors and remove only the
named smoke container. After successful smoke and owner approval, push and create:

```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet
docker push "$IMAGE"
DIGEST=$(gcloud artifacts docker images describe "$IMAGE" --project=teacher-hub-pdf --format='value(image_summary.digest)')
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]
gcloud run deploy teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 \
  --image="${IMAGE%:*}@$DIGEST" \
  --service-account=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com \
  --cpu=1 --memory=2Gi --concurrency=1 --min=0 --max=3 --min-instances=0 --max-instances=3 \
  --no-cpu-boost --cpu-throttling --timeout=30 --port=8080 --ingress=all \
  --invoker-iam-check --no-allow-unauthenticated \
  --startup-probe='httpGet.path=/health,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3' --quiet
gcloud run services add-iam-policy-binding teacher-pdf-worker \
  --project=teacher-hub-pdf --region=asia-southeast1 \
  --member=serviceAccount:teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com \
  --role=roles/run.invoker
gcloud run services describe teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --format=json
gcloud run services get-iam-policy teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --format=json
```

Confirm the invoker-check-disabled annotation is absent or `false`, resource limits
and runtime identity match, and service invoker binding contains only the named
invoker SA. No `allUsers`/`allAuthenticatedUsers`, including inherited grants.
Perform the anonymous 401/403 and impersonated 200 health tests above; any other
status is a failed bootstrap. Preserve only sanitized config, digest and revision.
Do not mark deployment ready merely because gcloud returned success.

First-deploy failure has no prior revision to restore. Stop further dispatches,
inspect the actual service state (creation may have partially succeeded), and ask
the owner to approve either repair or deletion of this exact health-only service.
Do not delete bucket/queue/repository or broaden deployer IAM. A pushed but unused
digest is handled by the approved image retention policy. Subsequent application
deployments use the existing checked workflow; IAM remains operator-controlled.

## Console checklist and API contract

- GitHub Settings → Environments → `pdf-worker`: independent reviewer, prevent
  self-review, disable administrator bypass; selected branch policy `main` only,
  no tag policy. Unsupported plan: keep workflow blocked and use the separately
  approved operator path; typed confirmation is not equivalent protection.
- GitHub Settings → Rulesets/Branches → `main`: require PR review and existing
  quality/integration/E2E checks; prevent force push and bypass. Verify actual
  check names on the repository before selecting required checks.
- GitHub Variables: verify all four GCP values, provider numeric project number
  and deployer email. Job uses `actions: read` for both environment GET and branch
  policy LIST, `contents: read` for checkout, `id-token: write` for WIF only.
- Google Cloud IAM → Workload Identity Federation: inspect issuer, attribute
  mappings and condition covering numeric repository/owner IDs, main ref,
  workflow_dispatch and exact workflow_ref as described above. Inspect the
  deployer SA binding for the environment subject; do not grant the whole pool.
- Google Cloud Run/IAM: operator performs approved bootstrap, inspects service and
  inherited policies; deployer remains Run Developer + repository Writer + runtime
  SA User. Verify WIF User separately. No service account key is needed.

Official endpoint documentation requires Actions read for both
[environment GET](https://docs.github.com/en/rest/deployments/environments#get-an-environment)
and [branch policy LIST](https://docs.github.com/en/rest/deployments/branch-policies#list-deployment-branch-policies).
Examples may omit `can_admins_bypass` or branch `type`. The validator deliberately
does not interpret an omitted field as secure: require explicit bypass=false and
type=branch. Missing fields, malformed response, 403/404 and transport errors block
WIF. Confirm the live response before declaring readiness; never relax checks to
work around an unsupported API/plan. API checks verify configuration, while GitHub
environment protection performs the actual approval gate.

## References

- [Google WIF deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google GitHub auth action](https://github.com/google-github-actions/auth)
- [Cloud Run deploy permissions](https://docs.cloud.google.com/run/docs/deploying)
- [gcloud run deploy flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy)
- [Cloud Tasks HTTP/OIDC](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)

## Hardening readiness gates

Protect main with PR review, no force pushes/bypass, and required existing quality,
integration, e2e-smoke and schedule-regression checks. Worker checks run in quality.
Require CODEOWNERS review for workflow/deployment changes where supported. Do not
change settings automatically. GitHub API read failure blocks WIF; operator must
verify token access to environment metadata before dispatch. Numeric OIDC identity,
ref/event/workflow restrictions must be enforced by the provider, not merely YAML.
Neither provider nor environment settings were inspected live in this task.

verify-wif: NOT READY until those external protections and Variables are verified.
Health deploy: NOT READY until operator bootstrap/IAM, container smoke and WIF pass.
CLI flags match the current gcloud reference; setup-gcloud uses its current release,
so actual CLI/API acceptance still requires the approved infrastructure test.
