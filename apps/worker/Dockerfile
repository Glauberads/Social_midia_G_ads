FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.0.0
RUN apk add --no-cache libc6-compat openssl

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune worker --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN pnpm --filter @projeto/database exec prisma generate --schema=prisma/schema.prisma
RUN pnpm turbo run build --filter=worker...

RUN pnpm prune --prod --config.ignore-scripts=true

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Copy root node_modules
COPY --from=installer --chown=worker:nodejs /app/node_modules ./node_modules

# Copy database package
COPY --from=installer --chown=worker:nodejs /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=installer --chown=worker:nodejs /app/packages/database/package.json ./packages/database/package.json

# Copy worker package
COPY --from=installer --chown=worker:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=installer --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=installer --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist

USER worker

# Handled via init in docker-compose or node runtime
CMD ["node", "apps/worker/dist/index.js"]
