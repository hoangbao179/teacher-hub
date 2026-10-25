# PDF Cloud rollout — one-shot private staging (operator only)

The code can be staged without exposing PDFs publicly. **This procedure has NOT been executed against live Google Cloud.** It must not be confused with production activation. Current public API and recovery CLI stay disabled without a separate private approval file and `PDF_API_ENABLED=true`.

## Prerequisites that must be approved and verified once

- The operator has Docker Linux/amd64 and `gcloud` on a trusted workstation, with approved Artifact Registry read/push and Cloud Run service update rights. Do **not** use a GitHub workload identity as a VPS production identity.
- Both `teacher-pdf-worker` and `teacher-pdf-gateway` **already exist and are private** with Cloud Run invoker IAM checking enabled. The script intentionally refuses to create a missing Gateway, to avoid accidentally creating a publicly accessible service. Any gateway service bootstrap and IAM change is a separate human-reviewed operation.
- The dedicated gateway service account `teacher-pdf-gateway@teacher-hub-pdf.iam.gserviceaccount.com` exists. Verify least-privilege Tasks queue get/create/task get, the fixed invoker-SA `actAs`, bucket object.get and create-only nonce objects, plus Secret Manager version read. Check *effective/inherited* IAM outside the script. Never grant Run Admin or Object Admin to Gateway.
- The Worker runtime identity has scoped bucket object.get and objects.create. The Worker has a private exact `roles/run.invoker` for the invoker service account and Cloud Tasks agent can mint OIDC. Verify HMAC secret rotation and the nonce lifecycle/cost. The script does not create IAM/secret.
- An approved Secret Manager **version number** exists (e.g. `teacher-pdf-gateway-hmac:1`), containing a **64-character lowercase hex** secret. Never paste the actual secret into CLI, env, Git or issue.
- The operator reviewed max instances, memory, costs and rollback, with `main` checked out cleanly. Source SHA must be the exact reviewed, CI-green source.

## One-shot staging

From **PowerShell** in the repository after obtaining the approved secret reference:

```powershell
git checkout main
git pull --ff-only
$env:SOURCE_SHA = (git rev-parse HEAD).Trim()
$env:PDF_GATEWAY_SECRET_VERSION = "teacher-pdf-gateway-hmac:1" # replace with approved Secret Manager version reference
node scripts/pdf-cloud-stage.mjs --plan

# ONLY after IAM, secret access and costs are approved:
$env:PDF_CLOUD_IAM_REVIEWED = "true"
$env:PDF_CLOUD_STAGE_APPROVED = "private-no-traffic"
node scripts/pdf-cloud-stage.mjs --stage
```

The staging tool checks the exact source SHA/clean worktree, existing service and direct private service policies **before any build/push**; builds/pushes both images; resolves immutable Artifact Registry digests; deploys a 1-vCPU/2-GiB Worker (concurrency 1, max 3, tmpfs 32Mi, processing gates enabled) and a 1-vCPU/256-MiB Gateway (concurrency 10, max 1, HMAC from Secret Manager) with `--no-traffic`. It checks that the old revision traffic remains unchanged. It never writes IAM, changes queue/bucket or VPS, sets up the recovery scheduler or enables public submissions. Cloud Run will continue serving its old revisions.

**If Gateway or privileges do not exist, the command intentionally fails before changes** (except that an error after staging Worker can leave a new 0%-traffic Worker revision; old traffic stays unchanged). Any preflight `run-processing-gates=FAIL` on the old live revision is expected until a separately approved rollout. A staged 0%-traffic Worker is NOT a validated production processor. Do not manually flip `PDF_API_ENABLED`, traffic, or Cloud Run invoker access just because staging succeeded.

## Final promotion — explicit approval separate from staging

Review the new revisions and image digests, private Worker/Gateway IAM, actual GCS/Tasks permission probes, Cloud Tasks OIDC audience, HMAC failures, nonce reservation, browser-close scheduler recovery and one authorized Drive PDF result. Approve redirecting Worker traffic only after Worker private probes pass. To let VPS call Gateway, changing Gateway invocation access is **security-sensitive**: review public HMAC boundary, abuse costs, rotation and budget before any IAM exposure. Configure the same private approval-file bootstrap for API and independently scheduled recovery CLI only after the cloud probes pass. Perform cross-device download and 24-hour expiry E2E. Record revisions and rollback decisions. Public submissions remain disabled until the owner explicitly approves the final activation.

Rollback first disables producer/API and schedule, then restores known-good revision traffic. A GCS nonce reservation is immutable and can be retained until the configured lifecycle expires; do not delete the bucket or existing MySQL outbox. This script does not implement automatic rollback of external resources.
