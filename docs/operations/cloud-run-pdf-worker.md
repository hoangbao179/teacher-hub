# Cloud Run PDF worker

## Scope and target

The owner confirms that the private **health-only** service is deployed, anonymous
health returns 403 and authenticated health returns 200. These are supplied
observations, not cloud checks repeated by this task. Source now includes a
default-disabled PDF job handler, verified only with local fixtures; it has not
been deployed or cloud-E2E verified. No cloud/IAM/queue mutation or VPS change is
authorized here. The [PoC](../features/pdf-quality-poc.md) remains separate. See
[worker architecture](../features/pdf-worker.md) and [contract v1](../api/pdf-worker-v1.md).

| Resource | Infrastructure reported by owner; IAM not re-inventoried here |
| --- | --- |
| Project / region | `teacher-hub-pdf` / `asia-southeast1` |
| Artifact Registry | `teacher-pdf` |
| Cloud Run service | `teacher-pdf-worker` (private health-only deployed) |
| Runtime identity | `teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com` |
| Verifier identity | `teacher-pdf-verifier@teacher-hub-pdf.iam.gserviceaccount.com` |
| Deployer identity | `teacher-pdf-deployer@teacher-hub-pdf.iam.gserviceaccount.com` |
| Future caller identity | `teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com` |
| Results bucket | `teacher-hub-pdf-results-2026` (private, seven-day lifecycle; worker not activated) |
| Queue | `teacher-pdf-queue` (no real tasks submitted here) |

The new image uses Node 24.18.0, qpdf/util-linux, no runtime npm dependencies, a
non-root user and an allowlisted source build context. TypeScript tooling/types
are dev-only in the separate worker package. With Cloud Run `K_SERVICE` set it
listens on `0.0.0.0:$PORT` (8080 default); local execution binds loopback.
It returns `200 {"status":"ok"}` for `GET /health`, supports `HEAD /health`,
returns 404 for disabled POST /jobs and unsupported routes, and drains on SIGTERM
with an eight-second bound. Interrupted jobs rely on redelivery and storage recovery.
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
| Approved GitHub WIF principal | `roles/iam.workloadIdentityUser` on the verifier SA only |
| Verifier SA | `roles/artifactregistry.reader` on repository `teacher-pdf` only |
| Deployer SA (manual only; preserve existing grants) | `roles/artifactregistry.writer` on repository `teacher-pdf` (push and read image digest) |
| Deployer SA | `roles/run.developer` on the dedicated project; existing-service update/get and getIamPolicy, no setIamPolicy |
| Deployer SA | `roles/iam.serviceAccountUser` on the runtime SA only (`iam.serviceAccounts.actAs`) |
| Cloud Run service agent | Google-managed `roles/run.serviceAgent`; same-project image pull relies on this service agent, not runtime Storage privileges |
| Runtime SA | Owner reports bucket Object Creator; processing also requires `storage.objects.get` on this bucket; no Tasks/Admin/delete/update/list permission needed |
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
Cloud Build is unused (Docker builds on the approved operator workstation). Storage/Tasks APIs and
data roles are not needed for health-only.

For a later queue integration, separately review task producer `roles/cloudtasks.enqueuer`
on the queue and `iam.serviceAccounts.actAs` on invoker SA, Cloud Tasks service
agent `roles/cloudtasks.serviceAgent` for OIDC tokens, service-scoped invoker binding,
and runtime bucket object permissions/retention. Do not activate any of these flows
now; the deployed revision remains health-only and source processing remains disabled.

## Processing activation: separate operator review, not performed in Task 1

Object Creator alone cannot read existing claims/results/output metadata. Minimal
additional bucket-scoped permission: `storage.objects.get`, preferably a custom
role alongside existing Creator. Object Viewer is a broader alternative because
it also grants list; review that extra exposure. No Object Admin, delete/update,
Tasks or project-wide data grant is needed. The worker preflights get/create using
bucket testPermissions (itself needs no extra IAM permission) before source access
or object writes. Tokens come from the fixed Cloud Run metadata endpoint; no keys
or user Drive OAuth are supported. IAM changes remain operator-only.

Before activation, after Tasks 2/3 and private cloud E2E:

1. Inspect actual runtime identity, private bucket/IAM/lifecycle, IAM invoker check
   and invoker binding. Record the current revision/digest/traffic/config for rollback.
2. Build/smoke locally, review the image and immutable digest. The retained
   health-only deploy script does not configure processing prerequisites and must
   not be used for activation; its default-disabled 404 job smoke remains valid.
3. Configure a dedicated **in-memory volume**, mount `/tmp/pdf-worker`, explicit
   size limit **32 MiB**, writable by non-root UID/GID 1000. In Console: service →
   revision/container configuration → Volumes → In-memory → mount path and size.
   Reviewed revision YAML fragment (not applied by this task):

   ```yaml
   containers:
   - image: REVIEWED_IMAGE_AT_SHA256_DIGEST
     volumeMounts:
     - name: pdf-temp
       mountPath: /tmp/pdf-worker
   volumes:
   - name: pdf-temp
     emptyDir:
       medium: Memory
       sizeLimit: 32Mi
   ```

   Confirm non-root writability on Cloud Run; do not switch to root or silently
   use unbounded writable root. Preflight checks tmpfs type, total capacity at
   most 32 MiB and free bytes at least PDF_MAX_BYTES. This volume consumes the
   existing 2 GiB RAM. Hard-killed attempts can leave files until instance shutdown;
   if free-space preflight fails, stop dispatch and recycle the instance. Do not
   remove durable claims/results to unblock processing.
4. Set `PDF_TEMP_ROOT=/tmp/pdf-worker`, `PDF_WORKER_IAM_READY=true` after review,
   and finally `PDF_PROCESSING_ENABLED=true` only after all activation gates pass.
   Cloud Run supplies `K_SERVICE`. Default processing remains 404; enabled but
   unready returns 503. `PDF_MAX_BYTES`, `PDF_MAX_PAGES`, `PDF_DEADLINE_MS` can only
   lower the 10 MiB/40 pages/22 seconds ceilings.
5. Keep 1 vCPU / 2 GiB / concurrency 1 / min 0 / max 3 / request timeout 30 seconds.
   Larger PDFs require benchmark/review, not automatic resource/timeout changes.
   Cloud Run's root is not made read-only by this code; local smoke verifies
   read-only-root compatibility using a separate bounded temporary volume.
6. Separately review Task 2 producer/queue permissions and retry/cost limits.
   OIDC identity is the invoker SA; audience is **service base URL**, without
   `/jobs`. Verify an owned real Drive download, private queue dispatch/storage,
   duplicate delivery, failures and expiry before teacher access.

Task 2 must authorize teacher downloads and deny them after `expiresAt` (24 hours
from first claim), using attachment/nosniff headers. The existing seven-day bucket
lifecycle is eventual cleanup. Worker creates no signed URL. Queue attempts/rate,
producer limits and monitoring must account for retries/duplicate transfers;
max instances alone does not cap monthly cost. Review regional CPU/memory/request,
storage/operations/network egress, registry layers, cache and log retention costs.

For future approved rollout, build the reviewed SHA locally, scan/package-review,
push only when separately authorized, resolve registry digest and deploy exactly
`IMAGE@sha256:...` with disabled gates first. Inspect the full revision diff,
mount, IAM and cost settings before final activation. Keep the prior digest.
Task 1 performs no cloud build/push/deploy/config command.

To roll back future activation: stop producers first, disable processing, then
restore the reviewed health-only revision's traffic and previous service config.
Traffic rollback alone does not restore environment, mount, scaling or IAM. Keep
private IAM and claims/results until retry windows close; do not auto-delete data.

References: [bounded Cloud Run memory volumes](https://docs.cloud.google.com/run/docs/configuring/services/in-memory-volume-mounts),
[GCS permission preflight](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets/testIamPermissions).

## Verification and manual deployment

GitHub Actions supports only manual **verify-wif**, using the verifier identity.
There is no deployment mode, image build/push, IAM mutation or Cloud Run call.
Run local checks without cloud authentication, MySQL or browser:

```bash
node --test scripts/validate-pdf-environment.test.cjs
npm --prefix workers/pdf run check
npm --prefix workers/pdf test
npm --prefix workers/pdf run test:docker
bash -n scripts/deploy-pdf-worker.sh
bash scripts/deploy-pdf-worker.test.sh
```

The Bash regression mocks all cloud/container calls. It is not a cloud dry run.
Install standalone dev tooling first with `npm ci --prefix workers/pdf`.
For native Linux tests, install `qpdf` and `util-linux` and verify both `qpdf` and
`prlimit` are executable before E2E. The Fast quality gate installs and probes
these dependencies explicitly; a generic Ubuntu runner is not the worker image.
Missing/inaccessible parser executables or launcher failures are retryable
SERVICE_UNAVAILABLE, not a permanently invalid PDF. Production diagnostics never
expose parser stderr; only the controlled missing-executable test prints its
sanitized fixture error. The Linux E2E remains required and is not skipped.
`test:docker` builds only `teacher-pdf-worker:local-processing-v1`; it pins a
local context and rejects remote endpoint overrides. It runs Linux/amd64 with
1 CPU, 2 GiB/no swap, non-root user, read-only root, 32 MiB `/tmp` tmpfs, network
none, 128 PIDs, dropped capabilities and no-new-privileges. Tests are a read-only
bind mount, excluded from the runtime image. It prints image size and whole-suite
cgroup peak/CPU/wall metrics, not production throughput. No credentials are mounted.

Manual equivalent (replace WORKER_TEST_DIRECTORY with an absolute local path):

```bash
docker build --platform linux/amd64 -t teacher-pdf-worker:local-processing-v1 workers/pdf
docker run --rm --network none --cpus=1 --memory=2g --memory-swap=2g \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=128 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777 \
  --mount type=bind,source=WORKER_TEST_DIRECTORY,target=/app/test,readonly \
  teacher-pdf-worker:local-processing-v1 node test/linux-run.mjs
docker image inspect teacher-pdf-worker:local-processing-v1 --format '{{.Id}} {{.Size}}'
```

For later health-only manual updates, first approve the resource/cost budget,
verify the existing private service, and validate the Linux image. The historical
bootstrap below is only for separately approved recovery, not an update. Use a clean,
reviewed checkout on a trusted workstation with approved operator credentials
(or an already-authorized human impersonating the deployer). Confirm the active
gcloud account and any configured impersonation before proceeding. No new human
impersonation grant is authorized by this task. No GitHub OIDC credentials may be
used. The script preserves private IAM and the separate runtime SA; it does not
configure credentials or grant roles. It rejects Actions markers, checks the
source SHA against HEAD, and refuses a dirty checkout:

```bash
export GCP_PROJECT_ID=teacher-hub-pdf GCP_REGION=asia-southeast1
export SOURCE_SHA=$(git rev-parse HEAD)
export CONFIRMATION=deploy-health-only
bash scripts/deploy-pdf-worker.sh
```

A shell marker is defense in depth, not authorization. Removing GitHub's deployer
impersonation grants is mandatory even though no workflow calls this script.

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
layers, revisions, runner build cache and logs. Do not change bucket lifecycle in
this step. Local Linux processing smoke is available; real processing IAM, WIF,
regional quota/billing and private cloud PDF E2E still need operator verification.
Health-only anonymous/authenticated smoke is owner-reported PASS. This does not
approve production processing or the PoC pipeline.

## Historical health-only bootstrap: operator only, after explicit approval

The service already exists according to the owner. Do not repeat bootstrap or its
IAM commands for Task 1 or to activate processing. Retained for recovery context;
creation/deletion/IAM actions require a separate operator review.

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
deployments use the manual script above; IAM remains operator-controlled.

### Validator runtime and language

Keep this small adapter CommonJS: `actions/github-script@v8` supplies `github`,
`context` and a checkout-relative `require()`; the workflow calls the exported
async function directly on Node 24. `.mjs` with dynamic import is possible but
adds no benefit here and would require action-runtime verification. TypeScript
would need a compatible execution/build mechanism; do not add one just for this
adapter. A brief JSDoc describes its boundary; runtime schema guards and Node
regressions cover untrusted responses. Adding checkJs solely here would require
new type plumbing for the injected Octokit client, without replacing runtime
validation. Revisit typed extraction if the module grows beyond this adapter.

Application code remains TypeScript by default (strict client/server/shared
configs). Shared emits ESM and CommonJS; server uses Node16 module resolution;
client uses ESNext/Bundler. Root automation mostly uses `.mjs`, with `.cjs`
adapters where needed. The standalone worker retains a small `.mjs` lifecycle
adapter outside root workspaces; new business modules use erasable TypeScript,
standalone tsc checks and Node 24 native stripping, without runtime npm dependencies.

## References

- [Google WIF deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google GitHub auth action](https://github.com/google-github-actions/auth)
- [Cloud Run deploy permissions](https://docs.cloud.google.com/run/docs/deploying)
- [gcloud run deploy flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy)
- [Cloud Tasks HTTP/OIDC](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)

## Single-owner Console setup and independent security gates

Perform these steps as the authorized operator, **before dispatch**. This runbook
is not permission for automated IAM changes. Existing deployer deployment roles
remain unchanged. Reviewer approval is not simulated in a single-owner repository.

1. Google Cloud Console → select `teacher-hub-pdf` → IAM & Admin → Service
   Accounts → Create service account: ID `teacher-pdf-verifier`. Skip project-role
   grants and key creation. Verify its email exactly matches the table above.
2. Artifact Registry → Repositories → `teacher-pdf` in `asia-southeast1` →
   Permissions → Grant access: verifier email, **Artifact Registry Reader**
   (`roles/artifactregistry.reader`). Grant on this repository, not the project.
   Inspect IAM including inherited roles, groups, conditional bindings and custom
   roles. Verifier must have no Run Developer/Admin, Registry Writer, Storage
   Admin, Tasks Admin, Token Creator, Owner/Editor, actAs, or equivalent custom
   permissions. No extra permission is required for this metadata-only check.
3. IAM & Admin → Workload Identity Federation → inspect the pool and provider.
   Use a dedicated pool or audit **every provider** in the shared pool: a binding
   is pool-scoped and another provider must not mint the same trusted attributes.
   Issuer: `https://token.actions.githubusercontent.com`; retain the normal exact
   provider audience expected by google-github-actions/auth. Map
   `google.subject=assertion.sub` and
   `attribute.repository_id=assertion.repository_id`. Review the condition below
   before saving any operator-approved provider change. Do not broaden audiences.
4. Service Accounts → verifier → Permissions → Grant access (or the WIF pool's
   Grant access / service-account impersonation flow): grant only
   `roles/iam.workloadIdentityUser` **on verifier** to this principal set, replacing
   PROJECT_NUMBER and POOL with inspected values:
   `principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/attribute.repository_id/1306563928`.
   Do not grant the entire pool, project-wide WIF User, or Token Creator.
5. **Separate security gate: revoke GitHub access to deployer.** Service Accounts
   → `teacher-pdf-deployer` → Permissions: inspect all WIF User/Token Creator and
   custom impersonation bindings, their members and conditions. Record the exact
   old member/role/condition for review, without tokens or keys. After operator
   approval, remove GitHub subject/principalSet grants, including broad pool grants.
   Also inspect project/folder/organization inherited grants, direct resource grants
   to federated principals, other SAs reachable by that principal, and delegation
   chains via verifier. Remove or restrict the offending grant at its actual scope;
   changing one SA-local binding is insufficient if an inherited path remains.
   Preserve deployer's Run Developer, Registry Writer, runtime SA User and approved
   human access. No automatic IAM update is performed by this repository.
   Re-read policies to establish **no GitHub-to-deployer path**. If unverified,
   do not dispatch. Deleting `GCP_DEPLOYER_SA` alone does not revoke impersonation.
6. GitHub Settings → Secrets and variables → Actions → Variables (or environment
   variables): set `GCP_VERIFIER_SA` to the verifier email. Verify `GCP_PROJECT_ID`,
   `GCP_REGION`, `GCP_WIF_PROVIDER`; provider is a full numeric-project resource
   name. Remove obsolete deployer variable if unused elsewhere; no JSON keys.
7. Settings → Environments → `pdf-worker`: Required reviewers OFF is supported;
   admin bypass OFF; selected branches/tags: exactly **Branch main**, no tags or
   wildcards. Settings → Rules → Rulesets: active main/default-branch rule requiring
   PR (zero approvals for single owner), existing four CI checks, no deletion or
   force push. Inspect bypass actors with authenticated administration access;
   do not invent an independent reviewer or disable CI to allow merge.
8. Only after the IAM/provider gates and variables are verified, and source is
   merged with required CI passing: Actions → `pdf-worker-manual` → Run workflow
   → `main`. There are no mode/confirmation inputs. Merging still triggers the
   existing VPS CI/deployment workflow, a separate effect requiring owner review.
   This task does not merge or dispatch. Success proves token exchange and registry
   metadata read only; it cannot prove absence of privileges. Never print JWT,
   access token or generated credential files; inspect sanitized errors only.

Provider attribute condition (numeric IDs verified from the repository REST API;
re-check ownership before applying):

```text
assertion.repository_id == '1306563928' &&
assertion.repository_owner_id == '52443962' &&
assertion.ref == 'refs/heads/main' &&
assertion.event_name == 'workflow_dispatch' &&
assertion.workflow_ref == 'hoangbao179/teacher-hub/.github/workflows/pdf-worker.yml@refs/heads/main' &&
assertion.sub == 'repo:hoangbao179@52443962/teacher-hub@1306563928:environment:pdf-worker'
```

These are GitHub OIDC claims for this non-reusable workflow. Confirm custom subject
configuration before applying; a changed subject should fail closed, not cause the
condition to be removed. The environment subject alone does not restrict the ref.
Provider conditions restrict token acceptance; SA/resource IAM restricts what the
accepted principal can impersonate or access. Neither is replaced by JavaScript.

### API contract and enforcement boundaries

GitHub Environment enforces selected branch/tag admission (and any configured
review/wait rules). Workflow checks repository, full main ref, dispatch event,
exact verifier email/project/region and provider-name syntax before auth. The
validator reads exactly `pdf-worker`, requires its matching name, protection-rules
array, explicit `can_admins_bypass=false`, custom policies true and protected-branch
selection false, then exactly one policy named main with explicit type branch.
Reviewers and prevent-self-review are not prerequisites for read-only verification.

[Environment GET](https://docs.github.com/en/rest/deployments/environments#get-an-environment)
and [policy LIST](https://docs.github.com/en/rest/deployments/branch-policies#list-deployment-branch-policies)
require Actions read; checkout requires Contents read; OIDC requires id-token write.
No broader GitHub permission is requested. REST examples/generated schemas may omit
`type` or `can_admins_bypass`; omission is **not** evidence of a safe value. This
validator deliberately blocks such responses because branch/tag and bypass state
cannot be established. Live GitHub responses observed here include both fields.
Do not bypass the check on a plan/API that omits them. Missing/malformed essential
fields, 403/404/500 or transport errors fail before Google authentication.

### Verification status and readiness

Owner reported single-owner Environment and main ruleset setup. Read-only GitHub
REST inspection additionally confirmed on 2026-10-24: environment name pdf-worker,
no reviewer rule, bypass false, custom-only policy, one main branch policy; numeric
repo/owner IDs above; active ruleset 25771531 and effective main rules requiring PR,
Fast quality gate, Server integration tests, Production smoke E2E and Schedule
regression gate, blocking deletion/non-fast-forward. Public REST did not expose
bypass actors; authenticated operator inspection is still needed for that field.
No Cloud IAM/provider inventory, variable values or real WIF exchange was verified.

verify-wif: **NOT READY** until verifier least privilege, provider trust, no GitHub
impersonation of deployer, variables and remaining GitHub settings are verified.
Cloud Run health-only deployment: owner reports deployed, anonymous 403 and
authenticated 200. PDF processing deployment/activation: **NOT READY** pending
Tasks 2/3, reviewed IAM/mount/config, authorized real Drive fixture and private
cloud E2E. No cloud state was changed or independently inventoried by Task 1.
