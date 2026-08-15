#!/bin/sh
set -e

# Aplica migraciones solo si RUN_MIGRATIONS=1 (recomendado ejecutarlas como
# un Job separado en Cloud Run para evitar carreras entre instancias).
if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "Aplicando migraciones de Prisma..."
  # Se invoca por la ruta real (no por .bin/prisma) para que Prisma resuelva
  # correctamente sus archivos internos (wasm/engines) en la imagen standalone.
  node ./node_modules/prisma/build/index.js migrate deploy
fi

echo "Iniciando servidor Next.js..."
exec node server.js
