#!/usr/bin/env bash
# Daily backup for slime_prod. Intended for Baota scheduled task.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/www/backup/postgres}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_NAME="${DB_NAME:-slime_prod}"
DB_USER="${DB_USER:-slime_prod_user}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

# Prefer peer/local auth as postgres, then fall back to DATABASE_URL if provided.
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=custom --no-owner --no-acl --file="${BACKUP_FILE}" "${DATABASE_URL}"
elif id postgres >/dev/null 2>&1; then
  sudo -u postgres pg_dump --format=custom --no-owner --no-acl --file="${BACKUP_FILE}" "${DB_NAME}"
else
  echo "[ERROR] Neither DATABASE_URL nor local postgres user is available"
  exit 1
fi

find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.dump" -mtime +"${KEEP_DAYS}" -delete

SIZE="$(du -h "${BACKUP_FILE}" | awk '{print $1}')"
echo "[OK] Backup created: ${BACKUP_FILE} (${SIZE})"
