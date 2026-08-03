#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="/opt/teacher-hub"
readonly ENV_FILE="$APP_DIR/.env"
readonly COMPOSE_FILE="$APP_DIR/docker-compose.deploy.yml"
readonly BACKUP_DIR="$APP_DIR/backups"
readonly BACKUP_RETENTION_DAYS=14
readonly MIN_FREE_DISK_KIB=1048576
readonly MIN_FREE_INODES=10000
readonly NEW_IMAGE_TAG="${1:-}"

for required_command in docker flock awk gzip curl mktemp install find df cp; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Missing required deployment command: $required_command"
    exit 2
  fi
done

if [[ ! "$NEW_IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Image tag must be a full 40-character Git commit SHA."
  exit 2
fi

if [[ ! -f "$APP_DIR/deploy-env.sh" ]]; then
  echo "Missing $APP_DIR/deploy-env.sh."
  exit 2
fi
# shellcheck source=deploy-env.sh
source "$APP_DIR/deploy-env.sh"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from .env.deploy.example on the VPS."
  exit 2
fi
if ! deploy_validate_env_file "$ENV_FILE"; then
  echo "The active deployment env is invalid; deployment was not started."
  exit 2
fi
if [[ ! -f "$COMPOSE_FILE" || ! -f "$APP_DIR/Caddyfile" ]]; then
  echo "Deployment files are incomplete in $APP_DIR."
  exit 2
fi

cd "$APP_DIR"
exec 9>"$APP_DIR/.deploy.lock"
if ! flock -n 9; then
  echo "Another production deployment is already running."
  exit 3
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

check_storage_headroom() {
  local free_disk_kib free_inodes
  free_disk_kib="$(df -Pk "$APP_DIR" | awk 'NR == 2 { print $4 }')"
  free_inodes="$(df -Pi "$APP_DIR" | awk 'NR == 2 { print $4 }')"
  if [[ ! "$free_disk_kib" =~ ^[0-9]+$ || ! "$free_inodes" =~ ^[0-9]+$ ]]; then
    echo "Could not determine deployment filesystem capacity."
    return 1
  fi
  if (( free_disk_kib < MIN_FREE_DISK_KIB || free_inodes < MIN_FREE_INODES )); then
    echo "Insufficient deployment storage headroom: ${free_disk_kib} KiB and ${free_inodes} inodes free."
    echo "At least ${MIN_FREE_DISK_KIB} KiB and ${MIN_FREE_INODES} inodes are required before deployment."
    return 1
  fi
}

wait_for_healthy() {
  local service="$1"
  local attempts="${2:-60}"
  local container_id status
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    container_id="$(compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$status" == "healthy" ]]; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "Service $service did not become healthy."
  compose ps
  return 1
}

wait_for_readiness() {
  local healthcheck_url="https://tienganhcovy.com/ready"

  for ((attempt = 1; attempt <= 45; attempt += 1)); do
    if compose exec -T web wget -q -O - http://127.0.0.1:8080/ready >/dev/null 2>&1 \
      && curl --fail --silent --show-error --max-time 10 "$healthcheck_url" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "Production readiness check failed."
  return 1
}

prune_application_images() {
  local current_tag="$1"
  local rollback_tag="$2"
  local owner component repository image_refs removable_refs reference
  local failed=0
  owner="$(deploy_read_env_value "$ENV_FILE" GHCR_OWNER)" || return 1

  for component in api web; do
    repository="ghcr.io/$owner/teacher-hub-$component"
    if ! image_refs="$(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repository")"; then
      echo "Could not list local images for $repository."
      failed=1
      continue
    fi
    removable_refs="$(deploy_list_removable_image_refs "$repository" "$current_tag" "$rollback_tag" <<< "$image_refs")"
    while IFS= read -r reference; do
      if [[ -z "$reference" ]]; then
        continue
      fi
      echo "Removing obsolete application image $reference."
      if ! docker image rm "$reference"; then
        echo "Could not remove $reference; Docker may still have a container referencing it."
        failed=1
      fi
    done <<< "$removable_refs"
  done

  return "$failed"
}

previous_tag="$(deploy_read_env_value "$ENV_FILE" IMAGE_TAG)"
if [[ -n "$previous_tag" && ! "$previous_tag" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Existing IMAGE_TAG is not an immutable full commit SHA."
  exit 2
fi

# Before pulling, retain only the currently active application SHA. This makes room
# for the new pair while guaranteeing that a failed deploy can restore the active pair.
if ! prune_application_images "$previous_tag" ""; then
  echo "Pre-deploy image cleanup was incomplete; storage headroom will decide whether deployment may continue."
fi
if ! docker image prune --force >/dev/null; then
  echo "Dangling-image cleanup failed; storage headroom will decide whether deployment may continue."
fi
check_storage_headroom

deployment_changed=0
temporary_backup=""
rollback_env="$(mktemp "$APP_DIR/.env.rollback.XXXXXX")"
if ! cp --preserve=mode "$ENV_FILE" "$rollback_env"; then
  rm -f "$rollback_env"
  echo "Could not create the deployment env rollback snapshot."
  exit 1
fi
rollback() {
  local exit_code="$1"
  local line="$2"
  local env_restored=0
  trap - ERR
  set +e
  if [[ -n "$temporary_backup" ]]; then
    rm -f "$temporary_backup"
  fi
  echo "Deployment failed at line $line. The database will not be rolled back automatically."
  if [[ -n "$rollback_env" && -f "$rollback_env" ]]; then
    if mv -f "$rollback_env" "$ENV_FILE"; then
      rollback_env=""
      env_restored=1
    else
      echo "Could not restore the deployment env snapshot; skipping automatic image rollback."
    fi
  fi
  if [[ "$deployment_changed" == "1" && -n "$previous_tag" && "$env_restored" == "1" ]]; then
    echo "Rolling application images back to the previous immutable tag."
    compose pull api web
    compose up -d --remove-orphans
    wait_for_healthy api 30
    wait_for_healthy web 30
  else
    echo "No previous immutable image tag is available for automatic image rollback."
  fi
  exit "$exit_code"
}
trap 'rollback "$?" "$LINENO"' ERR

deploy_set_image_tag "$ENV_FILE" "$NEW_IMAGE_TAG"
deployment_changed=1

compose config --quiet
compose up -d mysql
wait_for_healthy mysql 60

install -m 700 -d "$BACKUP_DIR"
schema_migrations_table_count="$(
  # Variables in this command intentionally expand inside the MySQL container.
  # shellcheck disable=SC2016
  compose exec -T mysql sh -c \
    'exec mysql --batch --skip-column-names --user=root --password="$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '\''schema_migrations'\''"'
)"

if [[ "$schema_migrations_table_count" == "0" ]]; then
  previous_tag=""
  echo "Initial deploy detected: skipping database backup"
elif [[ "$schema_migrations_table_count" == "1" ]]; then
  backup_file="$BACKUP_DIR/pre-migrate-$(date -u +%Y%m%dT%H%M%SZ)-${NEW_IMAGE_TAG:0:12}.sql.gz"
  temporary_backup="${backup_file}.tmp"
  rm -f "$temporary_backup"
  # Variables in this command intentionally expand inside the MySQL container.
  # shellcheck disable=SC2016
  compose exec -T mysql sh -c \
    'exec mysqldump --user=root --password="$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
    | gzip -c > "$temporary_backup"
  gzip -t "$temporary_backup"
  uncompressed_size="$(gzip -cd "$temporary_backup" | wc -c)"
  if [[ ! -s "$temporary_backup" || "$uncompressed_size" -eq 0 ]]; then
    echo "Database backup is empty."
    exit 1
  fi
  mv -f "$temporary_backup" "$backup_file"
  chmod 600 "$backup_file"
else
  echo "Could not determine whether the production database was initialized."
  exit 1
fi

compose pull
compose run --rm --no-deps api node dist/db/migrate.js
compose up -d --remove-orphans
wait_for_healthy api 60
wait_for_healthy web 60
wait_for_healthy caddy 30
wait_for_readiness

# Readiness commits the application deployment. Maintenance failures after this point
# must be visible to CI, but must never roll a healthy deployment back.
trap - ERR
maintenance_failed=0
if ! rm -f "$rollback_env"; then
  echo "Could not remove the deployment env rollback snapshot."
  maintenance_failed=1
else
  rollback_env=""
fi
if ! find "$BACKUP_DIR" -type f -name 'pre-migrate-*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete; then
  echo "Could not apply pre-migration backup retention."
  maintenance_failed=1
fi
# Keep the new SHA and exactly one local rollback generation for API and Web.
if ! prune_application_images "$NEW_IMAGE_TAG" "$previous_tag"; then
  echo "Post-deploy application image retention was incomplete."
  maintenance_failed=1
fi
if ! docker image prune --force >/dev/null; then
  echo "Post-deploy dangling-image cleanup failed."
  maintenance_failed=1
fi
if [[ "$maintenance_failed" == "1" ]]; then
  echo "Production is ready, but post-deploy maintenance failed."
  exit 4
fi
echo "Production deployment completed for image tag $NEW_IMAGE_TAG."
