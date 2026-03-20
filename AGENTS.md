# AGENTS.md

This document provides essential information for agentic coding agents working in the BearUang repository.

## Project Overview

BearUang is a monorepo containing a backend API built with:
- **Runtime**: Bun (v1.3.10+)
- **Framework**: Elysia.js
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: better-auth with organization support and API keys
- **Validation**: Zod
- **Logging**: Pino

## Project Structure

```
bearuang/
├── packages/
│   └── backend/           # Backend API service
│       ├── src/
│       │   ├── generated/     # Prisma generated client (git-ignored)
│       │   ├── integrations/  # External service integrations (auth, prisma)
│       │   ├── libraries/     # Shared utilities and helpers
│       │   ├── plugins/       # Elysia plugins and middleware
│       │   └── index.ts       # Application entry point
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema
│       │   └── migrations/    # Database migrations
│       └── prisma.config.ts   # Prisma configuration
├── docker-compose.yml     # PostgreSQL development database
└── package.json           # Root workspace configuration
```

## Development Commands

### Root Commands
```bash
bun install                  # Install all dependencies
bun run dev:backend          # Run backend with watch mode
```

### Backend Commands (run from packages/backend/)
```bash
bun run dev                  # Start development server with hot reload and pino-pretty
bun run db:generate          # Generate Prisma client
bun run db:migrate           # Create and apply migration (dev)
bun run db:migrate:deploy    # Apply migrations (production)
bun run db:push              # Push schema changes without migration
bun run db:pull              # Pull schema from database
bun run db:studio            # Open Prisma Studio GUI
bun run db:seed              # Seed database
bun run db:reset             # Reset database (migrations + seed)
bun run db:validate          # Validate Prisma schema
bun test                     # Run tests (not yet configured)
```

### Database Setup
```bash
docker-compose up -d         # Start PostgreSQL container
bun run db:migrate           # Apply migrations
bun run db:generate          # Generate Prisma client
```

## Environment Variables

Required environment variables in `packages/backend/.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- Additional better-auth configuration as needed

## Code Style Guidelines

### Imports
- **Use path alias**: Always use `@/*` for imports from src directory
  ```typescript
  import { auth } from "@/integrations/auth";
  import { logger } from "./libraries/utilities";
  ```
- **Order**: External packages first, then internal modules
- **Quotes**: Use double quotes for imports
- **File extensions**: Omit `.ts` extensions in imports

### TypeScript
- **Strict mode**: Enabled - all strict type checking options are on
- **Target**: ES2021
- **Module**: ES2022 with Node module resolution
- **Path aliases**: Use `@/*` mapping for `./src/*`
- **Type exports**: Export types explicitly using `export type`
  ```typescript
  export type App = typeof app;
  ```

### Naming Conventions
- **Files**: camelCase with `.ts` extension
  - `auth.plugin.ts` - plugins
  - `utilities.ts` - libraries
  - `auth.ts` - integrations
- **Variables**: camelCase
- **Constants**: camelCase for regular constants
- **Types/Interfaces**: PascalCase
- **Prisma models**: PascalCase (e.g., `User`, `Session`, `Organization`)
- **Database tables**: lowercase with snake_case via `@@map` (e.g., `@@map("user")`)
- **Export names**: Match file purpose (e.g., `authPlugin` from `auth.plugin.ts`)

### Formatting
- **No semicolons**: Bun/JavaScript default (not enforced)
- **Indentation**: 2 spaces
- **Trailing commas**: Use in multi-line structures
- **Line width**: Keep reasonable (80-120 chars)
- **Quotes**: Double quotes for strings
- **No comments**: Do not add comments unless absolutely necessary for complex logic

### Error Handling
- **Elysia error handling**: Use `.onError()` hook at app level
  ```typescript
  .onError(({ error }) => {
    logger.error(error);
  })
  ```
- **Plugin-level errors**: Return `status(code)` for HTTP errors
  ```typescript
  if (!session) return status(401);
  ```
- **Logging**: Use pino logger for all logging
  ```typescript
  logger.error(error);
  logger.info(message);
  ```

### Code Organization
- **Integrations**: External service connections (Prisma, better-auth)
- **Libraries**: Shared utilities, helpers, and constants
- **Plugins**: Elysia plugins and reusable middleware macros
- **Generated**: Auto-generated code (Prisma client) - never edit manually

### Elysia Patterns
- **Macro definitions**: For reusable authentication/authorization logic
  ```typescript
  new Elysia({ name: "auth" }).macro({
    requireAuth: { ... },
    requireOrg: { ... }
  })
  ```
- **Route handlers**: Use method chaining
- **Mount external handlers**: Use `.mount()` for better-auth
  ```typescript
  .mount(auth.handler)
  ```

### Prisma Patterns
- **Schema**: Define models in `prisma/schema.prisma`
- **Client location**: Generated to `src/generated/prisma/client`
- **Adapter**: Use PrismaPg adapter for connection pooling
  ```typescript
  export const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  ```
- **Migrations**: Always use migrations for schema changes in production
- **Development**: Can use `db:push` for rapid prototyping

### Validation
- **Zod schemas**: Use Zod for request/response validation
- **OpenAPI integration**: Pass Zod to OpenAPI plugin
  ```typescript
  mapJsonSchema: { zod: z.toJSONSchema }
  ```

## Testing

**Status**: Not yet configured

When implementing tests:
- Use Bun's built-in test runner
- Place test files alongside source files with `.test.ts` or `.spec.ts` extension
- Run single test: `bun test path/to/file.test.ts`
- Run all tests: `bun test`

## Database Workflow

1. **Modify schema**: Edit `prisma/schema.prisma`
2. **Create migration**: `bun run db:migrate` (names migration interactively)
3. **Generate client**: `bun run db:generate` (automatic with migrate)
4. **Use in code**: Import from `@/generated/prisma/client` or via `@/integrations/prisma`

## API Documentation

- **OpenAPI spec**: Available at `/openapi/json`
- **Swagger UI**: Available at `/openapi`
- **Tags**: Use tags to organize endpoints (e.g., "Health")

## Important Notes

- **No ESLint/Prettier**: Project does not currently use linting/formatting tools
- **No test framework**: Tests not yet implemented
- **Bun runtime**: Use Bun-specific APIs and package manager
- **Hot reload**: Development server auto-restarts on file changes
- **Generated code**: Never commit or manually edit `src/generated/`
- **Environment files**: Use `.env.local` for local development
