#!/usr/bin/env bash
set -Eeuo pipefail
# Same running API container, config and DB leases; no extra container/SDK.
cd /opt/teacher-hub
exec 9>/run/lock/teacher-pdf-recovery.lock
flock -n 9 || exit 0
docker compose --env-file .env -f docker-compose.deploy.yml exec -T \
  api node --max-old-space-size=64 dist/scripts/reconcile-pdf.js
