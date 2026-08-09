FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.0.0
RUN apk add --no-cache libc6-compat openssl

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune api --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
# Generate Prisma Client only after the complete database workspace and schema exist.
RUN pnpm --filter @projeto/database exec prisma generate --schema=prisma/schema.prisma

# Build the api and its workspace dependencies.
RUN pnpm turbo run build --filter=api...

# Prune dev dependencies for a smaller image
RUN pnpm prune --prod --config.ignore-scripts=true

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy root node_modules
COPY --from=installer --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy database package
COPY --from=installer --chown=nestjs:nodejs /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=installer --chown=nestjs:nodejs /app/packages/database/package.json ./packages/database/package.json

# Copy api package
COPY --from=installer --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=installer --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

USER nestjs
EXPOSE 3001
ENV PORT=3001

# Handled via init in docker-compose or node runtime
CMD ["node", "apps/api/dist/main.js"]
