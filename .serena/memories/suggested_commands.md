# Suggested Commands

## General
- `bun install`: Install dependencies in the monorepo.
- `bun dev`: Run both frontend and backend in parallel.

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
