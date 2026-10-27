#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pdf-v2-deploy.sh"
APP_DIR="$(mktemp -d)"
trap 'rm -rf "$APP_DIR"' EXIT
mkdir -p "$APP_DIR/pdf-runtime"
runtime="$APP_DIR/pdf-runtime/runtime.env"
printf '%s\n' '# preserve comments' 'PRIVATE_CONFIG=literal$with=equals' 'PDF_API_ENABLED=false' \
  'PDF_CHUNKED_JOBS_ENABLED=false' 'PDF_LONG_PRINT_TASKS_ENABLED=false' > "$runtime"
chmod 600 "$runtime"
pdf_v2_enable_env
cp "$runtime" "$APP_DIR/expected"
pdf_v2_enable_env
cmp "$runtime" "$APP_DIR/expected"
[[ "$(head -n 2 "$runtime" | tail -n 1)" == 'PRIVATE_CONFIG=literal$with=equals' ]]
[[ "$(grep -c '^PDF_.*=true$' "$runtime")" == 3 ]]
printf '%s\n' 'export PDF_API_ENABLED=false' >> "$runtime"
cp "$runtime" "$APP_DIR/expected"
if pdf_v2_enable_env; then echo 'ambiguous env must fail'; exit 1; fi
cmp "$runtime" "$APP_DIR/expected"
if pdf_v2_preflight; then echo 'missing evidence must fail'; exit 1; fi
# Candidate flags never modify existing runtime; command failure propagates.
compose() { printf '%s\n' "$*" > "$APP_DIR/compose-call"; return 17; }
if pdf_v2_verify_candidate; then exit 1; fi
grep -q -- '-e PDF_API_ENABLED=true -e PDF_CHUNKED_JOBS_ENABLED=true -e PDF_LONG_PRINT_TASKS_ENABLED=true' "$APP_DIR/compose-call"
echo 'PDF v2 env preservation, idempotency, fail-closed and candidate isolation passed'
