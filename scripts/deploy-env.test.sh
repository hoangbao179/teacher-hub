#!/usr/bin/env bash
set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-env.sh
source "$SCRIPT_DIR/deploy-env.sh"

test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
env_file="$test_dir/.env"

cat > "$env_file" <<'EOF'
GHCR_OWNER=teacher
IMAGE_TAG=1111111111111111111111111111111111111111
MYSQL_ROOT_PASSWORD=root-secret
DB_PASSWORD=db-secret
JWT_SECRET=jwt-secret
GOOGLE_DRIVE_ENABLED=false
GOOGLE_SHEET_SYNC_ENABLED=false
ARASAAC_ENABLED=true
PIXABAY_ENABLED=false
EOF

deploy_validate_env_file "$env_file"
original_checksum="$(sha256sum "$env_file")"

incomplete_env="$test_dir/.env.incomplete"
grep -v '^DB_PASSWORD=' "$env_file" > "$incomplete_env"
if deploy_validate_env_file "$incomplete_env"; then
  echo "Expected validation to reject an incomplete deployment env."
  exit 1
fi

stub_dir="$test_dir/stubs"
mkdir "$stub_dir"
cat > "$stub_dir/awk" <<'EOF'
#!/usr/bin/env bash
exit 28
EOF
chmod +x "$stub_dir/awk"

if PATH="$stub_dir:$PATH" deploy_set_image_tag "$env_file" 2222222222222222222222222222222222222222; then
  echo "Expected deploy_set_image_tag to fail when its write command fails."
  exit 1
fi

if [[ "$(sha256sum "$env_file")" != "$original_checksum" ]]; then
  echo "Active deployment env changed after a failed atomic update."
  exit 1
fi

deploy_set_image_tag "$env_file" 2222222222222222222222222222222222222222
deploy_validate_env_file "$env_file"
if [[ "$(deploy_read_env_value "$env_file" IMAGE_TAG)" != "2222222222222222222222222222222222222222" ]]; then
  echo "IMAGE_TAG was not updated after a successful atomic update."
  exit 1
fi

repository="ghcr.io/teacher/teacher-hub-api"
current_tag="2222222222222222222222222222222222222222"
rollback_tag="1111111111111111111111111111111111111111"
removable_refs="$(printf '%s\n' \
  "$repository:$current_tag" \
  "$repository:$rollback_tag" \
  "$repository:3333333333333333333333333333333333333333" \
  "$repository:latest" \
  "ghcr.io/another/teacher-hub-api:4444444444444444444444444444444444444444" \
  | deploy_list_removable_image_refs "$repository" "$current_tag" "$rollback_tag")"
if [[ "$removable_refs" != "$repository:3333333333333333333333333333333333333333" ]]; then
  echo "Image retention did not select exactly the obsolete scoped SHA tag."
  exit 1
fi

echo "Deployment env regression tests passed."
