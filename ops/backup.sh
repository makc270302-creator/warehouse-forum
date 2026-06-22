#!/bin/sh
set -eu

mkdir -p /backups

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/${PGDATABASE}_${timestamp}.sql.gz"
  pg_dump --no-owner --no-privileges | gzip -9 > "$target"
  find /backups -type f -name '*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
  sleep 86400
done
