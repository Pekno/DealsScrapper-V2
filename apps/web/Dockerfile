FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @dealscrapper/web build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/server.js ./server.js
EXPOSE 3000
CMD ["node", "server.js"]
