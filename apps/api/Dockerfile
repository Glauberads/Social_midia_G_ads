FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api build
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start:prod"]
