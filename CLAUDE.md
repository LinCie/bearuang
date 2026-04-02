# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BearUang is an ERP/inventory management system for Indonesian SMEs (UMKM). Monorepo with Turborepo: `packages/backend` (Bun + Elysia.js API) and `packages/frontend` (React 19 + TanStack SPA). UI language is Bahasa Indonesia.

## Common Commands

```bash
# Development
bun run dev                  # Start both frontend + backend
bun run dev:backend          # Backend only (port 8000)
bun run dev:frontend         # Frontend only (port 3000)

# Quality checks — ALWAYS run after changes
bun run check                # Prettier + ESLint + TypeScript (both packages)
bun run test                 # Run all tests

# Database (run from packages/backend/)
bun run db:migrate           # Create and apply migration (dev)
bun run db:migrate:deploy    # Apply migrations (production)
bun run db:generate          # Regenerate Prisma client after schema changes
bun run db:studio            # Prisma Studio GUI
bun run db:seed              # Seed database
bun run db:reset             # Reset database (migrations + seed)

# Frontend tests (run from packages/frontend/)
bun vitest run src/path/to/file.test.ts    # Single test file
bun vitest run -t "test name pattern"      # Tests matching name

# Infrastructure
docker-compose up -d         # Start PostgreSQL + MinIO
```

## Architecture

### Backend (`packages/backend/`)

- **Framework**: Elysia.js on Bun runtime
- **Database**: PostgreSQL via Prisma 7 (schema at `prisma/schema.prisma`)
- **Auth**: better-auth with organization plugin + API keys
- **Validation**: Zod v4 schemas for request/response, also generate OpenAPI docs

**Module pattern** — each domain lives in `src/modules/{domain}/` as an Elysia plugin:
```
src/
├── modules/         # 18 domain modules (products, variants, warehouses, etc.)
│   └── {domain}/
│       ├── {domain}.ts        # Route definitions (Elysia plugin)
│       ├── {domain}.service.ts # Pure Prisma queries, no HTTP concerns
│       └── {domain}.test.ts   # Tests
├── integrations/    # External services (auth, prisma, S3)
├── plugins/         # Elysia plugins (auth middleware)
├── libraries/       # Shared utilities (permissions, audit logger)
└── common/          # Shared types (pagination, error responses)
```

**Auth/permission macros** on routes: `requireAuth`, `requireOrg`, `requirePermission: { resource: ['action'] }`

**API type safety**: Backend exports `App` type. Frontend uses Eden Treaty (`@elysiajs/eden`) for fully typed API calls — no code generation needed.

### Frontend (`packages/frontend/`)

- **Routing**: TanStack Router file-based routes in `src/routes/`
- **State**: TanStack Query for server state
- **Forms**: TanStack Form + Zod v4
- **UI**: Tailwind CSS 4 + shadcn/ui (radix-vega)

**Module pattern** — each domain has `src/modules/{domain}/`:
```
src/
├── modules/{domain}/
│   ├── components/   # Domain-specific React components
│   └── hooks/        # TanStack Query hooks (use-{resource}.ts, query-keys.ts)
├── components/ui/    # shadcn/ui primitives
├── components/layouts/  # Page layouts
├── routes/           # File-based routing
│   └── _dashboard/   # Authenticated routes (require auth + org)
└── lib/
    ├── api.ts        # Eden Treaty client (fully typed)
    └── auth-client.ts # better-auth client
```

**Route permissions**: `/_dashboard/route.tsx` maps routes to required permissions (e.g., `/products` → `product:view`).

### Database Schema (Prisma)

19 models with UUID v7 IDs, soft deletes (`deletedAt`), and denormalized stock cache on `ProductVariant`. Key domains: products/variants, inventory (warehouses, stock movements), orders (purchase/sales), organizations/members/roles, audit logs.

## Key Patterns

- **Prettier config**: No semicolons, single quotes, trailing commas (all)
- **Path alias**: `@/*` → `./src/*` in both packages; frontend also maps `@/*` to backend src for cross-package type access
- **Audit logging**: All write operations use `logAudit()` tracking userId, authType, model, operation
- **Prisma client output**: `src/generated/prisma/` (git-ignored, must run `db:generate` after schema changes)
- **Offline-first (in progress)**: Dexie for IndexedDB caching, Workbox service worker, `/sync` backend endpoint

## Pre-commit Verification

After any code change, run `bun run check` from repo root. This runs Prettier fix, ESLint fix, and TypeScript type checking for both packages.
