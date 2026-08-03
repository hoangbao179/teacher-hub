#!/usr/bin/env bash

# Shared env-file operations for production deployment. This file is sourced by
# deploy-production.sh and kept separately so failure paths can be regression-tested.

deploy_read_env_value() {
  local env_file="$1"
  local key="$2"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

deploy_validate_env_file() {
  local env_file="$1"
  local required_key value count
  local -a required_keys=(
    GHCR_OWNER
    IMAGE_TAG
    MYSQL_ROOT_PASSWORD
    DB_PASSWORD
    JWT_SECRET
    GOOGLE_DRIVE_ENABLED
    GOOGLE_SHEET_SYNC_ENABLED
    ARASAAC_ENABLED
    PIXABAY_ENABLED
  )

  if [[ ! -s "$env_file" ]]; then
    echo "Deployment env file is missing or empty: $env_file"
    return 1
  fi

  for required_key in "${required_keys[@]}"; do
    count="$(awk -F= -v key="$required_key" '$1 == key { count += 1 } END { print count + 0 }' "$env_file")" || return 1
    if [[ "$count" != "1" ]]; then
      echo "Deployment env must contain exactly one $required_key entry."
      return 1
    fi
  done

  for required_key in GHCR_OWNER MYSQL_ROOT_PASSWORD DB_PASSWORD JWT_SECRET; do
    value="$(deploy_read_env_value "$env_file" "$required_key")" || return 1
    if [[ -z "$value" ]]; then
      echo "Deployment env value is empty: $required_key"
      return 1
    fi
  done

  value="$(deploy_read_env_value "$env_file" IMAGE_TAG)" || return 1
  if [[ -n "$value" && ! "$value" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Deployment IMAGE_TAG must be empty or a full 40-character Git commit SHA."
    return 1
  fi

  for required_key in GOOGLE_DRIVE_ENABLED GOOGLE_SHEET_SYNC_ENABLED ARASAAC_ENABLED PIXABAY_ENABLED; do
    value="$(deploy_read_env_value "$env_file" "$required_key")" || return 1
    if [[ "$value" != "true" && "$value" != "false" ]]; then
      echo "Deployment env value must be true or false: $required_key"
      return 1
    fi
  done
}

deploy_set_image_tag() {
  local env_file="$1"
  local tag="$2"
  local env_dir temporary
  env_dir="$(dirname "$env_file")"
  temporary="$(mktemp "$env_dir/.env.tmp.XXXXXX")" || return 1

  if ! awk -v tag="$tag" '
    BEGIN { updated = 0 }
    /^IMAGE_TAG=/ { print "IMAGE_TAG=" tag; updated = 1; next }
    { print }
    END { if (!updated) print "IMAGE_TAG=" tag }
  ' "$env_file" > "$temporary"; then
    rm -f "$temporary"
    echo "Could not write the updated deployment env; the active env was left unchanged."
    return 1
  fi

  if ! chmod --reference="$env_file" "$temporary" || ! mv -f "$temporary" "$env_file"; then
    rm -f "$temporary"
    echo "Could not activate the updated deployment env; the active env was left unchanged."
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -Eeuo pipefail
  if [[ "${1:-}" != "validate" || -z "${2:-}" || -n "${3:-}" ]]; then
    echo "Usage: deploy-env.sh validate <env-file>"
    exit 2
  fi
  deploy_validate_env_file "$2"
fi
