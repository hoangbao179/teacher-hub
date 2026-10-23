#!/usr/bin/env bash
set -euo pipefail

# Fail closed before any cloud call, including when invoked outside Actions.
test "${GITHUB_REPOSITORY:-}" = hoangbao179/teacher-hub
test "${GITHUB_REF:-}" = refs/heads/main
test "${GITHUB_EVENT_NAME:-}" = workflow_dispatch
test "${MODE:-}" = deploy
test "${CONFIRMATION:-}" = deploy-health-only
test "${GCP_PROJECT_ID:-}" = teacher-hub-pdf
test "${GCP_REGION:-}" = asia-southeast1
test "${GCP_DEPLOYER_SA:-}" = teacher-pdf-deployer@teacher-hub-pdf.iam.gserviceaccount.com
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]]

service=teacher-pdf-worker
registry="$GCP_REGION-docker.pkg.dev"
image="$registry/$GCP_PROJECT_ID/teacher-pdf/$service:$GITHUB_SHA"
runtime_sa=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com
cloud=(--project="$GCP_PROJECT_ID" --region="$GCP_REGION")
tmpdir=$(mktemp -d)
container="pdf-health-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
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

# List failing (API disabled/IAM/network) must not be mistaken for a missing service.
gcloud run services list "${cloud[@]}" --format=json > "$tmpdir/services.json"
exists=$(node --input-type=module - "$tmpdir/services.json" "$service" <<'NODE'
import fs from 'node:fs';
const services = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log(services.some(service => service.metadata.name === process.argv[3]));
NODE
)
if [[ "$exists" = true ]]; then
  gcloud run services get-iam-policy "$service" "${cloud[@]}" --format=json > "$tmpdir/policy.json"
  check_private_policy "$tmpdir/policy.json"
fi

docker build --pull --platform linux/amd64 -t "$image" workers/pdf
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
  --no-cpu-boost --cpu-throttling --timeout=30 --port=8080 \
  --ingress=all --invoker-iam-check --no-allow-unauthenticated \
  --startup-probe='httpGet.path=/health,httpGet.port=8080,periodSeconds=5,timeoutSeconds=2,failureThreshold=3' \
  --labels="component=pdf-worker,source-sha=$GITHUB_SHA" --quiet
gcloud run services get-iam-policy "$service" "${cloud[@]}" --format=json > "$tmpdir/policy.json"
check_private_policy "$tmpdir/policy.json"
gcloud run services describe "$service" "${cloud[@]}" --format=json > "$tmpdir/service.json"
node --input-type=module - "$tmpdir/service.json" <<'NODE'
import fs from 'node:fs';
const service = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (service.metadata.annotations?.['run.googleapis.com/invoker-iam-disabled'] === 'true') {
  throw new Error('Cloud Run IAM invoker check must remain enabled.');
}
NODE
echo 'Health-only revision deployed. Operator must still verify anonymous denial and authorized invocation.' >> "$GITHUB_STEP_SUMMARY"
