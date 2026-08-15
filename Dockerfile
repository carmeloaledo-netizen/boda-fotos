# ============================================================
#  Dockerfile multi-stage para boda-fotos (Next.js standalone)
#  Optimizado para Google Cloud Run.
# ============================================================

# ---- Dependencias -------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
# openssl es necesario para los engines de Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build --------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Genera el cliente Prisma y compila Next en modo standalone.
RUN npx prisma generate && npm run build

# ---- Runner -------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Usuario sin privilegios.
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Artefactos standalone de Next.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# node_modules completo (incluye la CLI de Prisma y TODAS sus dependencias)
# para poder aplicar migraciones de forma fiable al arrancar. Se copia después
# del standalone para complementarlo (es un superconjunto, no rompe el runtime).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
