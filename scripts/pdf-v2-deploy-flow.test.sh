#!/usr/bin/env bash
# Execute the real deploy orchestration with command fakes; no daemon/network/DB.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
mkdir "$ROOT/bin"
cat > "$ROOT/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$MOCK_ROOT/calls"
case "$*" in
  'image ls '*) exit 0;;
  'image prune '*) exit 0;;
  'inspect '*) echo healthy; exit 0;;
  *' ps -q '*) echo fixture-container; exit 0;;
  *'mysqldump '*) echo 'synthetic backup'; exit 0;;
  *'information_schema.tables'*) echo 1; exit 0;;
  *'dist/db/migrate.js'*) [[ "$SCENARIO" != migration ]]; exit;;
  *'run --rm --no-deps -T -e PDF_API_ENABLED=true'*) [[ "$SCENARIO" != candidate ]]; exit;;
  *'exec -T api node --max-old-space-size=64 dist/scripts/verify-pdf-v2.js'*) [[ "$SCENARIO" != live && "$SCENARIO" != active && "$SCENARIO" != unknown ]]; exit;;
  *'SELECT COUNT(*) AS n FROM pdf_jobs'*) if [[ "$SCENARIO" == unknown ]]; then exit 1; elif [[ "$SCENARIO" == active ]]; then echo 1; else echo 0; fi; exit;;
  *'process.stdin.on'*) cat >/dev/null; exit 0;;
esac
exit 0
STUB
cat > "$ROOT/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$MOCK_ROOT/system-calls"
case "$*" in
  *'--property=LoadState '*) if [[ "$SCENARIO" == missing ]]; then echo not-found; else echo loaded; fi;;
  *'--property=NeedDaemonReload '*) if [[ "$SCENARIO" == stale ]]; then echo yes; else echo no; fi;;
  *'--property=FragmentPath '*) echo "/etc/systemd/system/$2";;
  *'--property=DropInPaths '*) echo /etc/systemd/system/teacher-pdf-recovery.service.d/override.conf;;
  *'--property=User '*) if [[ "$SCENARIO" == root-service ]]; then echo root; else echo deploy; fi;;
  *'--property=Result '*) if [[ "$SCENARIO" == result ]]; then echo exit-code; else echo success; fi;;
  'is-active '*) [[ "$SCENARIO" != inactive ]];;
  'start teacher-pdf-recovery.service') [[ "$SCENARIO" != recovery ]];;
esac
STUB
cat > "$ROOT/bin/sudo" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$MOCK_ROOT/sudo-calls"
case "$*" in
  '-n systemctl enable --now teacher-pdf-recovery.timer'|'-n systemctl start teacher-pdf-recovery.service') ;;
  *) echo 'unexpected sudo command' >&2; exit 1;;
esac
[[ "$SCENARIO" != sudo ]] || exit 1
shift
exec "$@"
STUB
cat > "$ROOT/bin/id" <<'STUB'
#!/usr/bin/env bash
if [[ "$SCENARIO" == wrong-user ]]; then echo root; else echo deploy; fi
STUB
cat > "$ROOT/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
cat > "$ROOT/bin/install" <<'STUB'
#!/usr/bin/env bash
# Only backup-directory creation is permitted.
[[ "$*" == '-m 700 -d '* ]] || exit 1
mkdir -p "${@: -1}"
STUB
cat > "$ROOT/bin/curl" <<'STUB'
#!/usr/bin/env bash
echo '{"data":{"submitEnabled":true,"downloadEnabled":true,"maxPages":200}}'
STUB
cat > "$ROOT/bin/df" <<'STUB'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted\nfixture 99999999 1 99999998 1%% /\n'
STUB
chmod +x "$ROOT/bin/"*
export PATH="$ROOT/bin:$PATH"
for SCENARIO in success migration candidate sudo live recovery active unknown missing stale root-service wrong-user unowned writable writable-parent writable-dropin inactive result; do
  export SCENARIO
  MOCK_ROOT="$ROOT/$SCENARIO"; export MOCK_ROOT
  mkdir -p "$MOCK_ROOT/pdf-runtime"
  # Replace only the hardcoded deployment directory in the test copy.
  sed "s|readonly APP_DIR=\"/opt/teacher-hub\"|readonly APP_DIR=\"$MOCK_ROOT\"|" "$SCRIPT_DIR/deploy-production.sh" > "$MOCK_ROOT/deploy-production.sh"
  for helper in deploy-env.sh pdf-v2-deploy.sh; do tr -d '\r' < "$SCRIPT_DIR/$helper" > "$MOCK_ROOT/$helper"; done
  # Fake only host filesystem metadata; execute the real path/security gates.
  cat >> "$MOCK_ROOT/pdf-v2-deploy.sh" <<'STUB'

readlink() { echo "${@: -1}"; }
stat() { if [[ "$SCENARIO" == unowned ]]; then echo 1000; else echo 0; fi; }
test() {
  if [[ "$*" == '-f /etc/systemd/system/'* ]]; then return 0; fi
  if [[ "$1 $2" == '! -w' ]]; then
    case "$SCENARIO:${@: -1}" in
      writable:/etc/systemd/system/teacher-pdf-recovery.service|writable-parent:/etc/systemd/system|writable-dropin:*/override.conf) return 1;;
    esac
    return 0
  fi
  builtin test "$@"
}
STUB
  touch "$MOCK_ROOT/docker-compose.deploy.yml" "$MOCK_ROOT/Caddyfile" "$MOCK_ROOT/pdf-recovery.sh" \
    "$MOCK_ROOT/teacher-pdf-recovery.service" "$MOCK_ROOT/teacher-pdf-recovery.timer"
  printf '%s\n' 'GHCR_OWNER=fixture' 'IMAGE_TAG=1111111111111111111111111111111111111111' \
    'MYSQL_ROOT_PASSWORD=synthetic' 'DB_PASSWORD=synthetic' 'JWT_SECRET=synthetic' \
    'GOOGLE_DRIVE_ENABLED=false' 'GOOGLE_SHEET_SYNC_ENABLED=false' 'ARASAAC_ENABLED=true' 'PIXABAY_ENABLED=false' > "$MOCK_ROOT/.env"
  cp "$MOCK_ROOT/.env" "$MOCK_ROOT/old-env"
  sed 's/GHCR_OWNER=fixture/GHCR_OWNER=nextowner/' "$MOCK_ROOT/.env" > "$MOCK_ROOT/.env.next"
  printf '%s\n' 'PDF_API_ENABLED=true' 'PDF_CHUNKED_JOBS_ENABLED=false' 'OTHER=preserved' > "$MOCK_ROOT/pdf-runtime/runtime.env"
  cp "$MOCK_ROOT/pdf-runtime/runtime.env" "$MOCK_ROOT/old-runtime"
  echo '{}' > "$MOCK_ROOT/pdf-v2-readiness.json"
  status=0
  bash "$MOCK_ROOT/deploy-production.sh" 2222222222222222222222222222222222222222 > "$MOCK_ROOT/output" 2>&1 || status=$?
  if [[ "$SCENARIO" == success && "$status" != 0 ]]; then cat "$MOCK_ROOT/output"; exit 1; fi
  if [[ "$SCENARIO" == success || "$SCENARIO" == active || "$SCENARIO" == unknown ]]; then
    grep -q '^PDF_CHUNKED_JOBS_ENABLED=true$' "$MOCK_ROOT/pdf-runtime/runtime.env"
    grep -q '^IMAGE_TAG=2222222222222222222222222222222222222222$' "$MOCK_ROOT/.env"
    if [[ "$SCENARIO" == success ]]; then [[ "$status" == 0 ]];
    else [[ "$status" != 0 ]]; grep -q 'PDF_V2_ROLLBACK_BLOCKED' "$MOCK_ROOT/output"; fi
  else
    [[ "$status" != 0 ]]
    cmp "$MOCK_ROOT/old-runtime" "$MOCK_ROOT/pdf-runtime/runtime.env"
    cmp "$MOCK_ROOT/old-env" "$MOCK_ROOT/.env"
    case "$SCENARIO" in
      migration|candidate|sudo|missing|stale|root-service|wrong-user|unowned|writable|writable-parent|writable-dropin|inactive)
        ! grep -q -- '--force-recreate api' "$MOCK_ROOT/calls";;
    esac
  fi
  if [[ "$SCENARIO" == success ]]; then
    [[ "$(wc -l < "$MOCK_ROOT/sudo-calls")" == 2 ]]
    ! grep -q 'daemon-reload' "$MOCK_ROOT/system-calls"
  fi
  echo "Deployment scenario $SCENARIO passed"
done
