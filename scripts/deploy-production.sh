#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="/opt/teacher-hub"
readonly ENV_FILE="$APP_DIR/.env"
readonly COMPOSE_FILE="$APP_DIR/docker-compose.deploy.yml"
readonly BACKUP_DIR="$APP_DIR/backups"
readonly BACKUP_RETENTION_DAYS=14
readonly NEW_IMAGE_TAG="${1:-}"

for required_command in docker flock awk gzip curl mktemp install find; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Missing required deployment command: $required_command"
    exit 2
  fi
done

if [[ ! "$NEW_IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Image tag must be a full 40-character Git commit SHA."
  exit 2
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from .env.deploy.example on the VPS."
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

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

set_image_tag() {
  local tag="$1"
  local temporary
  temporary="$(mktemp "$APP_DIR/.env.tmp.XXXXXX")"
  awk -v tag="$tag" '
    BEGIN { updated = 0 }
    /^IMAGE_TAG=/ { print "IMAGE_TAG=" tag; updated = 1; next }
    { print }
    END { if (!updated) print "IMAGE_TAG=" tag }
  ' "$ENV_FILE" > "$temporary"
  chmod --reference="$ENV_FILE" "$temporary"
  mv -f "$temporary" "$ENV_FILE"
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

previous_tag="$(read_env_value IMAGE_TAG)"
if [[ -n "$previous_tag" && ! "$previous_tag" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Existing IMAGE_TAG is not an immutable full commit SHA."
  exit 2
fi

deployment_changed=0
temporary_backup=""
rollback() {
  local exit_code="$1"
  local line="$2"
  trap - ERR
  set +e
  if [[ -n "$temporary_backup" ]]; then
    rm -f "$temporary_backup"
  fi
  echo "Deployment failed at line $line. The database will not be rolled back automatically."
  if [[ "$deployment_changed" == "1" && -n "$previous_tag" ]]; then
    echo "Rolling application images back to the previous immutable tag."
    set_image_tag "$previous_tag"
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

set_image_tag "$NEW_IMAGE_TAG"
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

find "$BACKUP_DIR" -type f -name 'pre-migrate-*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
docker image prune --force >/dev/null
trap - ERR
echo "Production deployment completed for image tag $NEW_IMAGE_TAG."
