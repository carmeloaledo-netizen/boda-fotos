#!/bin/sh
set -e

# Aplica migraciones solo si RUN_MIGRATIONS=1 (recomendado ejecutarlas como
# un Job separado en Cloud Run para evitar carreras entre instancias).
if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "Aplicando migraciones de Prisma..."
  ./node_modules/.bin/prisma migrate deploy
fi

echo "Iniciando servidor Next.js..."
exec node server.js
