# --- Build stage: install deps, generate Prisma client, compile binary ---
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN bun install --frozen-lockfile

COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend

RUN bun run db:generate

ENV NODE_ENV=production

RUN bun build --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun \
    --outfile server \
    ./src/index.ts

# --- Migrate stage: run prisma migrate deploy ---
FROM oven/bun:1 AS migrate

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN bun install --frozen-lockfile

COPY packages/backend/prisma ./packages/backend/prisma
COPY packages/backend/prisma.config.ts ./packages/backend/prisma.config.ts

WORKDIR /app/packages/backend

ENTRYPOINT ["bunx", "--bun", "prisma", "migrate", "deploy"]

# --- Runtime stage: minimal image with compiled binary ---
FROM gcr.io/distroless/base-debian12 AS runtime

WORKDIR /app

COPY --from=build /app/packages/backend/server server

ENV NODE_ENV=production

EXPOSE 8000

CMD ["./server"]
