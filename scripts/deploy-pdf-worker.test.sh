#!/usr/bin/env bash
# Offline deployment orchestration regression. Every cloud/container command is mocked.
set -euo pipefail
cd "$(dirname "$0")/.."
tmpdir=$(mktemp -d)
trap 'rm -rf -- "$tmpdir"' EXIT
mkdir "$tmpdir/bin"
export MOCK_LOG="$tmpdir/calls"
cat > "$tmpdir/bin/gcloud" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "gcloud $*" >> "$MOCK_LOG"
case "$*" in
  'run services list '*)
    [[ "${MOCK_CASE:-}" != list-fails ]] || exit 1
    if [[ "${MOCK_CASE:-}" = new-service ]]; then echo '[]'
    else echo '[{"metadata":{"name":"teacher-pdf-worker"}}]'; fi ;;
  'run deploy '*) [[ "${MOCK_CASE:-}" != deploy-fails ]] || exit 1 ;;
  'run services get-iam-policy '*)
    [[ "${MOCK_CASE:-}" != iam-denied ]] || exit 1
    if [[ "${MOCK_CASE:-}" = public ]]; then
      echo '{"bindings":[{"role":"roles/run.invoker","members":["allUsers"]}]}'
    elif [[ "${MOCK_CASE:-}" = authenticated-public ]]; then
      echo '{"bindings":[{"role":"roles/run.invoker","members":["allAuthenticatedUsers"]}]}'
    else echo '{"bindings":[]}' ; fi ;;
  'artifacts docker images describe '*)
    if [[ "${MOCK_CASE:-}" = bad-digest ]]; then echo invalid
    else printf 'sha256:%064d\n' 0; fi ;;
  'run services describe '*)
    [[ "${MOCK_CASE:-}" != new-service && "${MOCK_CASE:-}" != list-fails ]] || exit 1
    if [[ "${MOCK_CASE:-}" = iam-disabled ]]; then
      echo '{"metadata":{"annotations":{"run.googleapis.com/invoker-iam-disabled":"true"}}}'
    else echo '{"metadata":{}}'; fi ;;
esac
SH
cat > "$tmpdir/bin/docker" <<'SH'
#!/usr/bin/env bash
echo "docker $*" >> "$MOCK_LOG"
if [[ "$1" = build && "${MOCK_CASE:-}" = build-fails ]]; then exit 1; fi
if [[ "$1" = exec && "${MOCK_CASE:-}" = smoke-fails ]]; then exit 1; fi
if [[ "$1" = inspect ]]; then echo 0; fi
exit 0
SH
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmpdir/bin/sleep"
chmod +x "$tmpdir/bin/"*
export PATH="$tmpdir/bin:$PATH"
export GITHUB_REPOSITORY=hoangbao179/teacher-hub GITHUB_REF=refs/heads/main
export GITHUB_EVENT_NAME=workflow_dispatch MODE=deploy CONFIRMATION=deploy-health-only
export GCP_PROJECT_ID=teacher-hub-pdf GCP_REGION=asia-southeast1
export GCP_DEPLOYER_SA=teacher-pdf-deployer@teacher-hub-pdf.iam.gserviceaccount.com
export GCP_WIF_PROVIDER=projects/123/locations/global/workloadIdentityPools/github/providers/github
export GITHUB_SHA=0123456789012345678901234567890123456789
export GITHUB_STEP_SUMMARY="$tmpdir/summary"

for guard in GITHUB_REPOSITORY GITHUB_REF GITHUB_EVENT_NAME MODE CONFIRMATION GCP_PROJECT_ID GCP_REGION GCP_DEPLOYER_SA GITHUB_SHA GCP_WIF_PROVIDER; do
  : > "$MOCK_LOG"
  if env "$guard=invalid" bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then
    echo "FAIL: $guard accepted"; exit 1
  fi
  test ! -s "$MOCK_LOG"
done
for ref in refs/tags/main refs/heads/main-extra main; do
  : > "$MOCK_LOG"
  if GITHUB_REF="$ref" bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then
    echo "FAIL: non-main-branch ref accepted"; exit 1
  fi
  test ! -s "$MOCK_LOG"
done
for failure in list-fails public authenticated-public build-fails smoke-fails bad-digest iam-disabled iam-denied new-service deploy-fails; do
  : > "$MOCK_LOG"
  if MOCK_CASE="$failure" bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then
    echo "FAIL: $failure accepted"; exit 1
  fi
  if [[ "$failure" != deploy-fails ]]; then
    if grep -q '^gcloud run deploy ' "$MOCK_LOG"; then echo "FAIL: deployed after $failure"; exit 1; fi
  fi
done
: > "$MOCK_LOG"
bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1
for expected in '--cpu=1' '--memory=2Gi' '--concurrency=1' '--min=0' '--max=3' \
  '--min-instances=0' '--max-instances=3' \
  '--service-account=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com' \
  'teacher-pdf-worker@sha256:' 'docker rm -f'; do
  grep -qF -- "$expected" "$MOCK_LOG"
done
if grep -qE -- '--(no-allow-unauthenticated|invoker-iam-check)|set-iam-policy|add-iam-policy-binding' "$MOCK_LOG"; then exit 1; fi
echo 'Deployment guards and orchestration passed (mock gcloud/docker only).'
