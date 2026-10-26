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
# Mock checkout metadata so regressions can run with uncommitted task changes.
cat > "$tmpdir/bin/git" <<'SH'
#!/usr/bin/env bash
[[ "${MOCK_CASE:-}" != git-fails ]] || exit 1
if [[ "$1" = rev-parse ]]; then echo 0123456789012345678901234567890123456789; fi
if [[ "$1" = status && "${MOCK_CASE:-}" = dirty ]]; then echo ' M workers/pdf/src/server.mjs'; fi
SH
chmod +x "$tmpdir/bin/git"
unset GITHUB_ACTIONS ACTIONS_ID_TOKEN_REQUEST_URL
export CONFIRMATION=deploy-health-only
export GCP_PROJECT_ID=teacher-hub-pdf GCP_REGION=asia-southeast1
export SOURCE_SHA=0123456789012345678901234567890123456789

for guard in GITHUB_ACTIONS ACTIONS_ID_TOKEN_REQUEST_URL CONFIRMATION GCP_PROJECT_ID GCP_REGION SOURCE_SHA; do
  : > "$MOCK_LOG"
  if env "$guard=invalid" bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then
    echo "FAIL: $guard accepted"; exit 1
  fi
  test ! -s "$MOCK_LOG"
done
# A valid-looking SHA must still match the reviewed checkout.
: > "$MOCK_LOG"
if SOURCE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then exit 1; fi
test ! -s "$MOCK_LOG"
for failure in git-fails dirty list-fails public authenticated-public build-fails smoke-fails bad-digest iam-disabled iam-denied new-service deploy-fails; do
  : > "$MOCK_LOG"
  if MOCK_CASE="$failure" bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1; then
    echo "FAIL: $failure accepted"; exit 1
  fi
  if [[ "$failure" = git-fails || "$failure" = dirty ]]; then test ! -s "$MOCK_LOG"; fi
  if [[ "$failure" != deploy-fails ]]; then
    if grep -q '^gcloud run deploy ' "$MOCK_LOG"; then echo "FAIL: deployed after $failure"; exit 1; fi
  fi
done
: > "$MOCK_LOG"
bash scripts/deploy-pdf-worker.sh > "$tmpdir/output" 2>&1
for expected in '--cpu=1' '--memory=2Gi' '--concurrency=1' '--min=0' '--max=3' \
  '--min-instances=0' '--max-instances=3' '--timeout=180' \
  '--service-account=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com' \
  'PDF_PRINT_FALLBACK_ENABLED=true' 'PDF_VIEWER_SCREEN_CAPTURE_ENABLED=true' \
  'mount-path=/tmp/pdf-worker' \
  'teacher-pdf-worker@sha256:' 'docker rm -f'; do
  grep -qF -- "$expected" "$MOCK_LOG"
done
if grep -qE -- '--(no-allow-unauthenticated|invoker-iam-check)|set-iam-policy|add-iam-policy-binding' "$MOCK_LOG"; then exit 1; fi
echo 'Deployment guards and orchestration passed (mock gcloud/docker only).'
