#!/usr/bin/env bash
set -euo pipefail

# Operator workstation only. This guard is defense in depth, not an IAM boundary.
# GitHub must have no impersonation grant on the deployer, even if this file changes.
test -z "${GITHUB_ACTIONS:-}"
test -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}"
test "${CONFIRMATION:-}" = deploy-health-only
test "${GCP_PROJECT_ID:-}" = teacher-hub-pdf
test "${GCP_REGION:-}" = asia-southeast1
[[ "${SOURCE_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
test "$SOURCE_SHA" = "$(git rev-parse HEAD)"
checkout_status=$(git status --porcelain)
test -z "$checkout_status"

service=teacher-pdf-worker
registry="$GCP_REGION-docker.pkg.dev"
image="$registry/$GCP_PROJECT_ID/teacher-pdf/$service:$SOURCE_SHA"
runtime_sa=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com
cloud=(--project="$GCP_PROJECT_ID" --region="$GCP_REGION")
tmpdir=$(mktemp -d)
container="pdf-health-local-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf -- "$tmpdir"; }
trap cleanup EXIT

check_private_policy() {
  node --input-type=module - "$1" <<'NODE'
import fs from 'node:fs';
const policy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if ((policy.bindings ?? []).some(binding =>
  (binding.members ?? []).some(member => ['allUsers', 'allAuthenticatedUsers'].includes(member)))) {
  throw new Error('Public IAM binding found; operator must review/remove it before deployment.');
}
NODE
}

check_private_service() {
  gcloud run services describe "$service" "${cloud[@]}" --format=json > "$tmpdir/service.json" || { echo 'Operator must bootstrap private service; run.services.get required.' >&2; exit 1; }
  node --input-type=module - "$tmpdir/service.json" <<'NODE'
import fs from 'node:fs';
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const disabled = s.metadata?.annotations?.['run.googleapis.com/invoker-iam-disabled'];
if (!s.metadata || (disabled !== undefined && disabled !== 'false')) throw new Error('IAM invoker check unsafe; operator action required');
NODE
  gcloud run services get-iam-policy "$service" "${cloud[@]}" --format=json > "$tmpdir/policy.json" || { echo 'run.services.getIamPolicy required; no IAM writes attempted.' >&2; exit 1; }
  check_private_policy "$tmpdir/policy.json"
}
check_private_service

docker build --pull --platform linux/amd64 -f workers/pdf/Dockerfile -t "$image" .
docker run -d --name "$container" --cpus=1 --memory=2g --memory-swap=2g \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  -p 127.0.0.1::8080 "$image" > /dev/null
# Probe inside the image, including that no job route is exposed.
for attempt in {1..15}; do
  if docker exec "$container" node --input-type=module -e '
    const h = await fetch("http://127.0.0.1:8080/health");
    if (h.status !== 200 || (await h.json()).status !== "ok") process.exit(1);
    const j = await fetch("http://127.0.0.1:8080/jobs", { method: "POST" });
    if (j.status !== 404) process.exit(1);
  '; then break; fi
  if [[ "$attempt" = 15 ]]; then exit 1; fi
  sleep 1
done
docker stop --time=10 "$container" > /dev/null
test "$(docker inspect --format='{{.State.ExitCode}}' "$container")" = 0

gcloud auth configure-docker "$registry" --quiet
docker push "$image"
# Deploy immutable content, not a mutable tag. Do not set a latest tag.
digest=$(gcloud artifacts docker images describe "$image" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
gcloud run deploy "$service" "${cloud[@]}" \
  --image="${image%:*}@$digest" --service-account="$runtime_sa" \
  --cpu=1 --memory=2Gi --concurrency=1 \
  --min=0 --max=3 --min-instances=0 --max-instances=3 \
  --no-cpu-boost --cpu-throttling --timeout=180 --port=8080 \
  --ingress=all \
  --startup-probe='httpGet.path=/health,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3' \
  --set-env-vars=PDF_PROCESSING_ENABLED=true,PDF_WORKER_IAM_READY=true,PDF_TEMP_ROOT=/tmp/pdf-worker,PDF_PRINT_FALLBACK_ENABLED=true,PDF_VIEWER_SCREEN_CAPTURE_ENABLED=true \
  --add-volume=name=pdf-temp,type=in-memory,size-limit=32Mi,mount-path=/tmp/pdf-worker \
  --labels="component=pdf-worker,source-sha=$SOURCE_SHA" --quiet
check_private_service
echo 'Health-only revision deployed. Operator must still verify anonymous denial and authorized invocation.'
