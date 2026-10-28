#!/usr/bin/env bash
# Sourced only by the locked production deployment. No credentials leave the VPS.
pdf_v2_verify_unit_path() {
  local path="$1" resolved candidate
  [[ "$path" == /* ]] && test -f "$path" || return 1
  resolved="$(readlink -e -- "$path")" || return 1
  # Check both paths: a protected target is insufficient if deploy can replace
  # a symlink or one of its parent directories. -w also respects host ACLs.
  for candidate in "$path" "$resolved"; do
    while :; do
      [[ "$(stat -Lc %u -- "$candidate")" == 0 ]] && test ! -w "$candidate" || return 1
      [[ "$candidate" != / ]] || break
      candidate="$(dirname -- "$candidate")"
    done
  done
}

pdf_v2_verify_recovery_units() {
  local unit fragment dropins path
  # Permission checks below must run as the identity used by the service.
  [[ "$(id -un)" == deploy ]] || {
    echo 'PDF_V2_BLOCKED: run deployment as deploy'; return 1;
  }
  for unit in teacher-pdf-recovery.service teacher-pdf-recovery.timer; do
    [[ "$(systemctl show "$unit" --property=LoadState --value)" == loaded &&
       "$(systemctl show "$unit" --property=NeedDaemonReload --value)" == no ]] || {
      echo "PDF_V2_BLOCKED: $unit must be installed and loaded by root"; return 1;
    }
    fragment="$(systemctl show "$unit" --property=FragmentPath --value)" || return 1
    dropins="$(systemctl show "$unit" --property=DropInPaths --value)" || return 1
    if ! pdf_v2_verify_unit_path "$fragment"; then
      echo "PDF_V2_BLOCKED: $unit must be root-owned and protected from deploy writes"; return 1;
    fi
    # systemd returns a space-separated list; unusual/escaped paths fail closed.
    for path in $dropins; do
      if ! pdf_v2_verify_unit_path "$path"; then
        echo "PDF_V2_BLOCKED: $unit has an unprotected drop-in"; return 1;
      fi
    done
  done
  [[ "$(systemctl show teacher-pdf-recovery.service --property=User --value)" == deploy ]] || {
    echo 'PDF_V2_BLOCKED: recovery service must run with User=deploy'; return 1;
  }
}

pdf_v2_preflight() {
  local evidence="$APP_DIR/pdf-v2-readiness.json"
  [[ -s "$evidence" && -s "$APP_DIR/pdf-runtime/runtime.env" ]] || {
    echo 'PDF_V2_BLOCKED: missing fresh Cloud readiness evidence or existing runtime.env'; return 1;
  }
  # Validate inside the candidate image; no local Node or cloud SDK on VPS.
  compose run --rm --no-deps -T -v "$evidence:/run/pdf-v2-readiness.json:ro" \
    api node -e '
      const e=JSON.parse(require("fs").readFileSync("/run/pdf-v2-readiness.json","utf8"));
      if(e.result!=="PASS" || e.sourceSha!==process.argv[1] || e.version!==1 ||
         !Number.isFinite(Date.parse(e.checkedAt)) || Date.now()-Date.parse(e.checkedAt)>1800000 ||
         Date.parse(e.checkedAt)>Date.now()+60000) process.exit(1);
    ' "$NEW_IMAGE_TAG"
  pdf_v2_verify_recovery_units
}

pdf_v2_enable_env() {
  local file="$APP_DIR/pdf-runtime/runtime.env" next
  next="$(mktemp "$APP_DIR/pdf-runtime/.runtime.XXXXXX")"
  # Only these exact keys are managed. Reject ambiguous variants instead of sourcing env.
  if ! awk '
    /^[[:space:]]*(export[[:space:]]+)?PDF_(API_ENABLED|CHUNKED_JOBS_ENABLED|LONG_PRINT_TASKS_ENABLED)[[:space:]]*=/ {
      if ($0 !~ /^PDF_(API_ENABLED|CHUNKED_JOBS_ENABLED|LONG_PRINT_TASKS_ENABLED)=/) exit 1;
      next
    }
    { print }
    END { print "PDF_API_ENABLED=true\nPDF_CHUNKED_JOBS_ENABLED=true\nPDF_LONG_PRINT_TASKS_ENABLED=true" }
  ' "$file" > "$next"; then rm -f "$next"; return 1; fi
  chmod --reference="$file" "$next"
  mv -f "$next" "$file"
}

pdf_v2_verify_candidate() {
  compose run --rm --no-deps -T \
    -e PDF_API_ENABLED=true -e PDF_CHUNKED_JOBS_ENABLED=true -e PDF_LONG_PRINT_TASKS_ENABLED=true \
    api node --max-old-space-size=64 dist/scripts/verify-pdf-v2.js
}

pdf_v2_install_recovery() {
  # Keep the orchestration entry point; unit installation is root provisioning.
  chmod 700 "$APP_DIR/pdf-recovery.sh"
  sudo -n systemctl enable --now teacher-pdf-recovery.timer
  systemctl is-enabled --quiet teacher-pdf-recovery.timer
  systemctl is-active --quiet teacher-pdf-recovery.timer
}

pdf_v2_verify_live() {
  compose exec -T api node --max-old-space-size=64 dist/scripts/verify-pdf-v2.js
  sudo -n systemctl start teacher-pdf-recovery.service
  [[ "$(systemctl show teacher-pdf-recovery.service --property=Result --value)" == success ]]
  systemctl is-enabled --quiet teacher-pdf-recovery.timer
  systemctl is-active --quiet teacher-pdf-recovery.timer
  curl --fail --silent --show-error --max-time 20 https://tienganhcovy.com/api/public/pdf/capabilities \
    | compose exec -T api node -e '
      let text="";process.stdin.on("data",c=>text+=c);process.stdin.on("end",()=>{
        const body=JSON.parse(text);const c=body.data??body;
        if(c.submitEnabled!==true||c.downloadEnabled!==true||c.maxPages!==200)process.exit(1);
      });'
  curl --fail --silent --show-error --location --max-time 20 https://tienganhcovy.com/tools >/dev/null
}
