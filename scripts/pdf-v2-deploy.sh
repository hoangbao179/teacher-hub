#!/usr/bin/env bash
# Sourced only by the locked production deployment. No credentials leave the VPS.
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
  if [[ "$(id -u)" == 0 ]]; then PDF_SYSTEM=();
  elif sudo -n true 2>/dev/null; then PDF_SYSTEM=(sudo -n);
  else echo 'PDF_V2_BLOCKED: deployment user needs noninteractive sudo for systemd installation'; return 1; fi
  "${PDF_SYSTEM[@]}" systemctl --version >/dev/null
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
  "${PDF_SYSTEM[@]}" install -m 644 "$APP_DIR/teacher-pdf-recovery.service" /etc/systemd/system/teacher-pdf-recovery.service
  "${PDF_SYSTEM[@]}" install -m 644 "$APP_DIR/teacher-pdf-recovery.timer" /etc/systemd/system/teacher-pdf-recovery.timer
  chmod 700 "$APP_DIR/pdf-recovery.sh"
  "${PDF_SYSTEM[@]}" systemctl daemon-reload
  "${PDF_SYSTEM[@]}" systemctl enable --now teacher-pdf-recovery.timer
  "${PDF_SYSTEM[@]}" systemctl is-enabled --quiet teacher-pdf-recovery.timer
  "${PDF_SYSTEM[@]}" systemctl is-active --quiet teacher-pdf-recovery.timer
}

pdf_v2_verify_live() {
  compose exec -T api node --max-old-space-size=64 dist/scripts/verify-pdf-v2.js
  "${PDF_SYSTEM[@]}" systemctl start teacher-pdf-recovery.service
  [[ "$("${PDF_SYSTEM[@]}" systemctl show teacher-pdf-recovery.service --property=Result --value)" == success ]]
  "${PDF_SYSTEM[@]}" systemctl is-enabled --quiet teacher-pdf-recovery.timer
  "${PDF_SYSTEM[@]}" systemctl is-active --quiet teacher-pdf-recovery.timer
  curl --fail --silent --show-error --max-time 20 https://tienganhcovy.com/api/public/pdf/capabilities \
    | compose exec -T api node -e '
      let text="";process.stdin.on("data",c=>text+=c);process.stdin.on("end",()=>{
        const body=JSON.parse(text);const c=body.data??body;
        if(c.submitEnabled!==true||c.downloadEnabled!==true||c.maxPages!==200)process.exit(1);
      });'
  curl --fail --silent --show-error --location --max-time 20 https://tienganhcovy.com/tools >/dev/null
}
