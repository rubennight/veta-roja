#!/usr/bin/env bash
# Respaldo de Veta Roja: base de datos (pg_dump) + imágenes subidas. Uso: bash deploy/backup.sh [carpeta]
# Restaurar: ver deploy/README-DEPLOY.md
set -euo pipefail

# Git Bash (Windows) convierte rutas como /data/uploads en rutas de Windows; esto lo evita.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/.."
OUT="${1:-backups}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
# COMPOSE_CMD permite apuntar a otra configuración (por defecto, la de deploy/).
read -ra COMPOSE <<< "${COMPOSE_CMD:-docker compose -f deploy/docker-compose.yml --env-file deploy/.env}"
mkdir -p "$OUT"

echo "→ Base de datos"
"${COMPOSE[@]}" exec -T postgres pg_dump -U vetaroja --clean --if-exists veta_roja | gzip > "$OUT/db-$STAMP.sql.gz"

echo "→ Imágenes subidas"
"${COMPOSE[@]}" exec -T app tar czf - -C /data/uploads . > "$OUT/uploads-$STAMP.tgz"

echo "Listo:"
ls -lh "$OUT/db-$STAMP.sql.gz" "$OUT/uploads-$STAMP.tgz"
