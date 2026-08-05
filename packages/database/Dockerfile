FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat openssl

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @projeto/database --docker

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN pnpm turbo run build --filter=@projeto/database...

# For migration, we need Prisma CLI, so we keep dev dependencies or use npx
# We run as node
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 migration

USER migration
CMD ["npx", "prisma", "migrate", "deploy", "--schema=packages/database/prisma/schema.prisma"]
