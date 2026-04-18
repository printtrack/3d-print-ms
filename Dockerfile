FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

# ─── builder ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# Pre-compile seed.ts → seed.js (ts-node not available in slim runner)
RUN node_modules/.bin/tsc --module commonjs --target ES2020 --esModuleInterop --skipLibCheck prisma/seed.ts

# ─── runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js output (server.js + traced runtime node_modules)
COPY --from=builder /app/.next/standalone ./
# Static assets must be placed alongside the standalone server
COPY --from=builder /app/.next/static ./.next/static
# Public directory (also needed by standalone)
COPY --from=builder /app/public ./public
# Prisma migrations, schema, and compiled seed.js
COPY --from=builder /app/prisma ./prisma
# Full node_modules for Prisma CLI + engines
COPY --from=builder /app/node_modules ./node_modules
RUN npx prisma generate

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && \
    mkdir -p public/uploads && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
