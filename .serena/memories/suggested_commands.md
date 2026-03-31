# Suggested Commands

## General (Root)
- `bun install`: Install dependencies in the monorepo.
- `bun run dev`: Run both frontend and backend in parallel.
- `bun run dev:backend`: Run backend only (via Turbo).
- `bun run dev:frontend`: Run frontend only (via Turbo).
- `bun run build`: Build all packages.
- `bun run build:backend`: Build backend only.
- `bun run build:frontend`: Build frontend only.
- `bun run check`: Run checks (lint, format, typecheck) for all packages.
- `bun run check:backend`: Check backend only.
- `bun run check:frontend`: Check frontend only.
- `bun run lint`: Run linting for all packages.
- `bun run format`: Run formatting for all packages.
- `bun run test`: Run tests for all packages.

## Database (Root)
- `bun run db:generate`: Generate Prisma client.
- `bun run db:migrate`: Run database migrations.
- `bun run db:push`: Push schema changes without migration.
- `bun run db:studio`: Open Prisma Studio.
- `bun run db:seed`: Seed the database.
- `bun run db:validate`: Validate Prisma schema.

## Backend (`packages/backend`)
- `bun run dev`: Run backend in development mode with watch mode.
- `bun run db:generate`: Generate Prisma client.
- `bun run db:migrate`: Run database migrations.
- `bun run db:studio`: Open Prisma Studio.

## Frontend (`packages/frontend`)
- `bun run dev`: Run frontend development server (default port 3000).
- `bun run build`: Build for production.
- `bun run test`: Run tests with Vitest.
- `bun run lint`: Run ESLint.
- `bun run format`: Check formatting with Prettier.
- `bun run check`: Automatically fix formatting/linting and run type check (`prettier --write . && eslint --fix && tsc --noEmit`).