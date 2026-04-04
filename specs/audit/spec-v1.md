---
title: Audit Logging Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: audit
tags: [audit, logging, fire-and-forget, elysia, prisma, react, tanstack, readonly-api]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the audit logging domain in BearUang. The audit module is unique: it is a **read-only API** for querying logs, while all writes are performed by the `logAudit()` library function called from every other backend write module. The query key factory (`auditLogKeys`) is imported by nearly every frontend module to invalidate the audit log cache after mutations.

## 1. Purpose & Scope

This specification defines:

- **Backend audit-logger library**: The `logAudit()` function and its fire-and-forget pattern using raw SQL INSERT
- **Backend route plugin**: The single read-only `GET /audit-logs` endpoint for listing audit logs with filters
- **Backend service**: The `auditService` with paginated listing and filtering
- **Frontend query key factory**: `auditLogKeys` — the cross-module dependency used by every write module's mutation hooks
- **Frontend hooks**: `useAuditLogs` hook wrapping the Eden Treaty API call
- **Frontend components**: `AuditLogsTable` and `AuditLogsFilters` for the audit log viewer
- **Prisma model**: The `AuditLog` model with its indexes
- **API contracts**: HTTP endpoints, request/response schemas, Zod validation

**Audience**: Developers building or modifying the audit module, or integrating audit logging into new modules.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, and the fire-and-forget pattern for non-critical writes.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Audit Log** | An immutable record of a write operation (create, update, delete, restore, etc.) capturing who did what, when, and how |
| **Fire-and-Forget** | A pattern where `logAudit()` is called with `void` (not awaited) so the HTTP response is never blocked by audit log writes |
| **AuditInput** | The TypeScript interface defining the required fields for an audit log entry |
| **Query Key Factory** | A hierarchical object (`auditLogKeys`) that generates TanStack Query cache keys for the audit log resource |
| **Auth Type** | Discriminates between `session` (user logged in via browser) and `api_key` (machine-to-machine) authentication |
| **Model** | The domain entity being operated on (e.g., `Product`, `SalesOrder`, `Member`) |
| **Operation** | The type of action performed (e.g., `create`, `update`, `delete`, `restore`, `receive`) |
| **Raw SQL INSERT** | The audit logger bypasses Prisma ORM and uses `$executeRaw` for maximum write throughput |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` in the raw SQL INSERT |
| **Cross-Module Dependency** | `auditLogKeys` is imported by 13 other frontend modules for cache invalidation after mutations |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The audit module resides in `packages/backend/src/modules/audit/` with `audit.route.ts` and `audit.service.ts`
- **REQ-002**: The route plugin is an Elysia instance with `{ prefix: '/audit-logs', tags: ['Audit Logs'] }`
- **REQ-003**: The route plugin uses `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: The endpoint declares `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permission is declared as `requirePermission: { auditLog: ['view'] }` — this is the only permission for audit logs
- **REQ-006**: The audit log API is **read-only** — there is no POST, PATCH, or DELETE endpoint; all writes go through the `logAudit()` library
- **REQ-007**: Zod schemas define query validation and response shapes
- **REQ-008**: The `auditLogSchema` uses `z.iso.datetime()` for the `createdAt` field
- **REQ-009**: The `args` field uses `z.unknown()` because it is a dynamic JSON object
- **REQ-010**: `serializeAuditLog()` converts the Prisma `Date` to ISO string before returning to client
- **REQ-011**: The `listAuditLogsQuery` extends `paginationQuery` with `sortQuery(['createdAt', 'model', 'operation'])` and adds `model`, `operation`, `authType`, and `userId` filters
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on the endpoint

### 3.2 Audit Logger Library

- **REQ-013**: The `logAudit()` function resides in `packages/backend/src/libraries/audit-logger.ts`
- **REQ-014**: `logAudit()` accepts an `AuditInput` object with `organizationId`, `userId`, `apiKeyId?`, `authType`, `model`, `operation`, and `args`
- **REQ-015**: `logAudit()` uses `prisma.$executeRaw` with raw SQL INSERT — it bypasses the Prisma client for performance
- **REQ-016**: The raw SQL INSERT uses PostgreSQL's `uuidv7()` function for the primary key
- **REQ-017**: `logAudit()` is called with `void` (not awaited) in all route handlers — fire-and-forget pattern
- **REQ-018**: Errors inside `logAudit()` are caught, logged via Pino logger, and silently swallowed to never block the parent request
- **REQ-019**: The `args` field is serialized with `JSON.stringify()` and cast to `::jsonb` in the SQL

### 3.3 Service Layer

- **REQ-020**: `auditService` is exported as an object literal: `export const auditService = { async listAuditLogs(...) {...} }`
- **REQ-021**: `listAuditLogs` uses `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-022**: All queries are scoped by `organizationId`
- **REQ-023**: Filter params (`model`, `operation`, `authType`, `userId`) are applied conditionally — only non-empty values are included in the `where` clause
- **REQ-024**: Default ordering is `{ createdAt: 'desc' }` (newest first)
- **REQ-025**: Default `take` is `50` when not specified

### 3.4 Frontend Architecture

- **REQ-026**: The audit-logs module resides in `packages/frontend/src/modules/audit-logs/` with `hooks/`, `components/`, and `index.ts`
- **REQ-027**: The `auditLogKeys` query key factory is defined in `hooks/use-audit-logs.ts` alongside the `useAuditLogs` hook
- **REQ-028**: `auditLogKeys` has three levels: `all`, `lists()`, and `list(params)`
- **REQ-029**: `auditLogKeys` is imported by every other frontend module's mutation hooks for cache invalidation after writes
- **REQ-030**: The `useAuditLogs` hook calls `api['audit-logs'].get()` with bracket notation due to the hyphenated route prefix
- **REQ-031**: Default pagination in the hook is `page: 1, pageSize: 50`
- **REQ-032**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-033**: Dates are formatted with `id-ID` locale

### 3.5 Database

- **REQ-034**: The `AuditLog` model uses UUID v7 primary key (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-035**: The `AuditLog` model has `organizationId`, `userId`, `apiKeyId`, `model`, `createdAt` indexes for query performance
- **REQ-036**: The `AuditLog` model maps to `audit_log` table via `@@map("audit_log")`
- **REQ-037**: The `AuditLog` model does **not** support soft delete — audit logs are immutable
- **REQ-038**: The `args` field is `Json` type storing the operation payload as JSONB
- **REQ-039**: `userId` and `apiKeyId` are nullable — one is populated depending on `authType`

### 3.6 Constraints

- **CON-001**: The hyphenated route prefix `/audit-logs` requires bracket notation in Eden client: `api['audit-logs']`
- **CON-002**: `void logAudit(...)` is fire-and-forget — audit log write failures do not affect the parent operation's response
- **CON-003**: The audit logger uses raw SQL, not Prisma ORM — any schema changes to `audit_log` must be reflected in the raw SQL template
- **CON-004**: `ipAddress` and `userAgent` are not populated by the current `logAudit()` implementation — these fields exist in the model but are currently unused (nullable)
- **CON-005**: `auditLogKeys` is a cross-module dependency — renaming or restructuring the query key factory requires updating all 13 consuming modules

### 3.7 Guidelines

- **GUD-001**: When adding a new backend write module, always call `void logAudit(...)` in every write endpoint (create, update, delete, restore)
- **GUD-002**: When adding a new frontend mutation hook, always invalidate `auditLogKeys.all` in the `onSuccess` callback
- **GUD-003**: When adding new model or operation values, update both the backend `logAudit()` call sites and the frontend `MODEL_OPTIONS` and `OPERATION_OPTIONS` arrays in `AuditLogsFilters`
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: The `auditLogKeys` import path should always be `#modules/audit-logs/hooks/use-audit-logs` to keep imports explicit and traceable

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/audit-logs` | List audit logs (paginated, filterable by model, operation, authType, userId) | `auditLog:view` | `{ data: AuditLog[], meta: PaginationMeta }` |

> **Note**: This is the only endpoint. Audit log writes are performed internally by the `logAudit()` library function, never exposed via HTTP.

### 4.2 Query Parameters (List Endpoint)

```typescript
interface ListAuditLogsQuery {
  page: number;          // default: 1
  pageSize: number;      // default: 10
  sortBy?: 'createdAt' | 'model' | 'operation';
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
  model?: string;        // exact match on model name (e.g., 'Product', 'SalesOrder')
  operation?: string;    // exact match on operation name (e.g., 'create', 'update')
  authType?: 'session' | 'api_key';  // filter by authentication method
  userId?: string;       // filter by user UUID
}
```

### 4.3 Response Shapes

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  apiKeyId: string | null;
  authType: string;
  model: string;
  operation: string;
  args: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;  // ISO 8601 datetime
}
```

### 4.4 Zod Schema Definitions

#### AuditLog Response Schema

```typescript
import { z } from 'zod'

const auditLogSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable(),
  apiKeyId: z.string().nullable(),
  authType: z.string(),
  model: z.string(),
  operation: z.string(),
  args: z.unknown(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
```

#### List Query Schema

```typescript
const listAuditLogsQuery = paginationQuery
  .extend(sortQuery(['createdAt', 'model', 'operation']).shape)
  .extend({
    model: z.string().optional(),
    operation: z.string().optional(),
    authType: z.enum(['session', 'api_key']).optional(),
    userId: z.string().optional(),
  })
```

#### AuditInput (Logger Library)

```typescript
interface AuditInput {
  organizationId: string
  userId: string
  apiKeyId?: string
  authType: 'session' | 'api_key'
  model: string
  operation: string
  args: Record<string, unknown>
}
```

### 4.5 Prisma Model

```prisma
model AuditLog {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  userId         String?
  apiKeyId       String?
  authType       String
  model          String
  operation      String
  args           Json
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([userId])
  @@index([apiKeyId])
  @@index([model])
  @@index([createdAt])
  @@map("audit_log")
}
```

**Indexes**:
- `@@index([organizationId])` — primary query filter for multi-tenant scoping
- `@@index([userId])` — filter audit logs by specific user
- `@@index([apiKeyId])` — filter audit logs by specific API key
- `@@index([model])` — filter audit logs by domain entity type
- `@@index([createdAt])` — supports ordering by recency and time-range queries

### 4.6 Audit Logger — Raw SQL INSERT

```typescript
async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "audit_log" ("id", "organizationId", "userId", "apiKeyId", "authType", "model", "operation", "args", "createdAt")
      VALUES (
        uuidv7(),
        ${input.organizationId}::text,
        ${input.userId ?? null}::text,
        ${input.apiKeyId ?? null}::text,
        ${input.authType}::text,
        ${input.model}::text,
        ${input.operation}::text,
        ${JSON.stringify(input.args)}::jsonb,
        now()
      )
    `
  } catch (err) {
    logger.error(
      { err, model: input.model, operation: input.operation },
      'audit log write failed',
    )
  }
}
```

**Key design decisions**:
- Raw SQL bypasses Prisma client overhead for maximum write throughput
- `uuidv7()` is a PostgreSQL function generating time-sortable UUIDs
- All string values are cast with `::text` for type safety
- `args` is serialized to JSON string and cast with `::jsonb`
- `now()` uses PostgreSQL server time for consistency
- Errors are caught and logged but never propagated to the caller

### 4.7 Backend Route Plugin

```typescript
export const auditRoute = new Elysia({
  prefix: '/audit-logs',
  tags: ['Audit Logs'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, model, operation, authType, userId } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await auditService.listAuditLogs(
        organization.id,
        { skip, take, model, operation, authType, userId },
      )
      return {
        data: data.map(serializeAuditLog),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { auditLog: ['view'] },
      query: listAuditLogsQuery,
      response: {
        200: paginatedResponse(auditLogSchema),
      },
      detail: {
        summary: 'List audit logs',
        description:
          'Retrieves a paginated list of audit logs for the authenticated organization. Supports filtering by model, operation, auth type, and user.',
      },
    },
  )
```

### 4.8 Backend Service

```typescript
export const auditService = {
  async listAuditLogs(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      model?: string
      operation?: string
      authType?: string
      userId?: string
    },
  ) {
    const where = {
      organizationId,
      ...(params?.model && { model: params.model }),
      ...(params?.operation && { operation: params.operation }),
      ...(params?.authType && { authType: params.authType }),
      ...(params?.userId && { userId: params.userId }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take ?? 50,
      }),
      prisma.auditLog.count({ where }),
    ])
    return { data, total }
  },
}
```

### 4.9 Frontend Query Key Factory

```typescript
// hooks/use-audit-logs.ts
export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (params: ListAuditLogsQuery) =>
    [...auditLogKeys.lists(), params] as const,
}
```

### 4.10 Frontend Cache Invalidation Pattern

The `auditLogKeys.all` key is invalidated by **every** mutation hook across the application:

```typescript
// Example from any mutation hook (products, variants, sales-orders, etc.)
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'

export function useCreateResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateInput) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })  // Always present
    },
  })
}
```

**Modules that import `auditLogKeys`** (13 total):
- `products` — use-products.ts, use-variants.ts
- `product-categories` — use-product-categories.ts
- `warehouses` — use-warehouses.ts
- `stock-movements` — use-stock-movements.ts
- `suppliers` — use-suppliers.ts
- `customers` — use-customers.ts
- `purchase-orders` — use-purchase-orders.ts
- `sales-orders` — use-sales-orders.ts
- `members` — use-members.ts
- `roles` — use-roles.ts
- `invitations` — use-invitations.ts
- `api-keys` — use-api-keys.ts
- `sync` — use-sync.ts

### 4.11 Frontend Hook

```typescript
export function useAuditLogs(params: Partial<ListAuditLogsQuery> = {}) {
  return useQuery({
    queryKey: auditLogKeys.list(params as ListAuditLogsQuery),
    queryFn: async () => {
      const { data, error } = await api['audit-logs'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          model: params.model,
          operation: params.operation,
          authType: params.authType,
          userId: params.userId,
        },
      })
      if (error) throw error
      return data
    },
  })
}
```

### 4.12 Frontend Component Structure

```
modules/audit-logs/
  index.ts                            # Barrel export: hooks + components
  hooks/
    index.ts                          # Re-exports from use-audit-logs
    use-audit-logs.ts                 # auditLogKeys factory + useAuditLogs hook
  components/
    index.ts                          # Re-exports from audit-logs-filters
    audit-logs-table.tsx              # Table with sortable columns and styled badges
    audit-logs-filters.tsx            # Filter dropdowns (model, operation, authType) with active filter badges
```

### 4.13 Frontend Components

#### AuditLogsTable

```typescript
interface AuditLogsTableProps {
  logs: AuditLog[]
  sortBy: 'createdAt' | 'model' | 'operation'
  sortOrder: 'asc' | 'desc'
  onSort: (column: 'createdAt' | 'model' | 'operation') => void
}
```

**Features**:
- Sortable columns: Waktu (createdAt), Model, Operasi (operation) with ascending/descending indicators
- Non-sortable columns: Metode Auth, Pengguna (hidden on < lg), IP (hidden on < xl)
- `AuthTypeBadge`: Displays "Sesi" (session) with green badge or "API Key" with amber badge
- `OperationBadge`: Color-coded badges per operation type — create (blue), update (amber), delete (rose), restore (green), receive (emerald), confirm (teal), reorder (violet), etc.
- Indonesian labels for all operations (Buat, Ubah, Hapus, Pulihkan, Terima, Tolak, etc.)
- Date formatting with `id-ID` locale showing day, month, year, hour, minute
- User ID truncated to 8 characters with ellipsis
- Responsive: Pengguna column hidden below `lg`, IP column hidden below `xl`

#### AuditLogsFilters

```typescript
interface AuditLogsFiltersProps {
  filters: {
    model: string
    operation: string
    authType: string
  }
  onFilterChange: (filters: {
    model: string
    operation: string
    authType: string
  }) => void
}
```

**Features**:
- Three `Select` dropdowns: Model (180px), Operasi (150px), Metode Auth (140px)
- All dropdowns have a "Semua ..." (All) default option using `__all__` sentinel value
- Active filters displayed as removable badge chips below the dropdowns
- Individual filter removal via `X` button on each badge
- "Reset semua" (Reset all) ghost button to clear all filters at once
- Model options: Produk, Varian Produk, Gudang, Pergerakan Stok, Pemasok, Pelanggan, Pesanan Pembelian, Pesanan Penjualan, Anggota, Undangan, API Key, Media
- Operation options: Buat, Ubah, Hapus, Pulihkan, Terima, Tolak, Presign, Konfirmasi, Urutkan, Buat Banyak, Ubah Banyak, Hapus Banyak

### 4.14 Backend Write Integration (logAudit Call Sites)

The `logAudit()` function is called from **every** backend write module. Each call follows this pattern:

```typescript
void logAudit({
  organizationId: organization.id,
  userId: user.id,
  authType: _authType,
  model: 'ResourceName',
  operation: 'create' | 'update' | 'delete' | 'restore' | 'receive' | 'accept' | 'reject' | ...,
  args: { data: body } | { id: params.id, data: body } | { id: params.id },
})
```

**Modules that call `logAudit()`** (14 total):
- `products` — create, update, delete, restore, image add, image delete, image reorder
- `variants` — create, update, delete, restore, image add, image delete, image reorder
- `product-categories` — create, update, delete, restore
- `warehouses` — create, update, delete
- `stock-movements` — create, update
- `suppliers` — create, update, delete
- `customers` — create, update, delete, restore
- `purchase-orders` — create, update, receive, confirm
- `sales-orders` — create, update, confirm
- `members` — create, update
- `roles` — create, update, delete
- `invitations` — create, accept, reject, revoke, resend
- `api-keys` — create, update, delete
- `sync` — createMany, updateMany, deleteMany
- `uploads` — presign, create, delete

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `auditLog:view` permission, When they `GET /audit-logs`, Then they receive a paginated list of audit logs scoped to their organization ordered by `createdAt` descending
- **AC-002**: Given an authenticated user, When they provide `model` query parameter, Then only audit logs matching that exact model name are returned
- **AC-003**: Given an authenticated user, When they provide `operation` query parameter, Then only audit logs matching that exact operation name are returned
- **AC-004**: Given an authenticated user, When they provide `authType` query parameter (`session` or `api_key`), Then only audit logs with that auth type are returned
- **AC-005**: Given an authenticated user, When they provide `userId` query parameter, Then only audit logs from that user are returned
- **AC-006**: Given multiple filter parameters, When they are combined, Then only audit logs matching all provided filters are returned (AND logic)
- **AC-007**: Given any backend write operation, When it completes successfully, Then an audit log entry is written with the correct model, operation, args, organizationId, userId, and authType
- **AC-008**: Given a write operation where `logAudit()` fails internally, When the parent operation completes, Then the HTTP response is still returned successfully (fire-and-forget)
- **AC-009**: Given an unauthenticated request, When `GET /audit-logs` is called, Then a `401 Unauthorized` is returned
- **AC-010**: Given a user without `auditLog:view` permission, When `GET /audit-logs` is called, Then a `403 Forbidden` is returned
- **AC-011**: Given any frontend mutation (create, update, delete, etc.), When it succeeds, Then the audit log query cache is invalidated via `auditLogKeys.all`
- **AC-012**: Given the audit logs table, When rendered, Then columns display data in Indonesian (Waktu, Model, Operasi, Metode Auth, Pengguna) with properly styled badges

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for `logAudit()` function and `auditService`; integration tests for the `GET /audit-logs` route handler
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `audit.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Audit Logger Tests**: Verify `logAudit()` generates correct raw SQL, handles errors gracefully, and does not throw on failure
- **Service Tests**: Verify filtering combinations (model + operation, authType + userId, empty filters return all)
- **Route Tests**: Verify pagination, sorting, filter parameters, permission checks
- **Frontend Testing**: Test `useAuditLogs` hook with `renderHook` + mock query client; test `AuditLogsTable` and `AuditLogsFilters` with `render` + mock data
- **Cross-Module Verification**: Ensure all mutation hooks in dependent modules invalidate `auditLogKeys.all`

## 7. Rationale & Context

### Why Fire-and-Forget?

Audit logging is important but not critical to the user's immediate operation. If the audit log write fails (database connectivity issue, constraint violation), the parent operation should still succeed. The `void logAudit(...)` pattern ensures zero latency impact on the primary response. Errors are logged for later investigation but never propagated to the HTTP response.

### Why Raw SQL INSERT Instead of Prisma?

The audit logger uses `prisma.$executeRaw` instead of `prisma.auditLog.create()` for maximum write throughput. Audit logs are high-volume, append-only records. Bypassing Prisma's client overhead (query building, type transformation, middleware chain) reduces per-write latency. The trade-off is that schema changes to `audit_log` must be manually reflected in the raw SQL template.

### Why No Soft Delete on Audit Logs?

Audit logs are immutable by design. Once written, they should never be modified or deleted (except by a separate admin/cleanup operation not covered by this spec). This ensures a complete, tamper-proof history of all write operations.

### Why is auditLogKeys a Cross-Module Dependency?

Every write operation in the application produces an audit log. To keep the audit log viewer up-to-date, every mutation hook must invalidate the audit log query cache. By importing `auditLogKeys.all` in every mutation hook's `onSuccess` callback, the audit log list automatically refreshes after any data change, providing a real-time activity feed.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience. Operation badges use Indonesian labels (Buat, Ubah, Hapus, Pulihkan) while the underlying `operation` field stores English identifiers for consistency.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for audit log entries; also provides `uuidv7()` function for raw SQL inserts

### Third-Party Services
- **SVC-001**: **better-auth** - Provides `authPlugin` with `user`, `organization`, `_authType` context used in `logAudit()` calls
- **SVC-002**: **Pino** - Structured logger used to record audit log write failures

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies (Consumers)
- **DAT-001**: **All backend write modules** (14 modules) depend on `logAudit()` from `#libraries/audit-logger` to record their operations
- **DAT-002**: **All frontend write modules** (13 modules) depend on `auditLogKeys` from `#modules/audit-logs/hooks/use-audit-logs` for cache invalidation

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer; also used for `$executeRaw` in audit logger
- **PLT-003**: **TanStack Query** - Server state management for frontend audit log queries and cross-module cache invalidation
- **PLT-004**: **shadcn/ui + Radix** - UI component primitives (Table, Select, Button) for audit log viewer

### Compliance Dependencies
- **COM-001**: **Audit logging** - This module provides the compliance mechanism itself; all write operations across the application are recorded

## 9. Examples & Edge Cases

### 9.1 Calling logAudit from a Write Endpoint

```typescript
// Example: Creating a product
.post('/', async ({ _authType, organization, user, body, status }) => {
  const product = await productService.createProduct(organization.id, body)
  void logAudit({
    organizationId: organization.id,
    userId: user.id,
    authType: _authType,
    model: 'Product',
    operation: 'create',
    args: { data: body },
  })
  return status(201, serializeProduct(product))
}, {
  requireAuth: true,
  requireOrg: true,
  requirePermission: { product: ['create'] },
  body: createProductDto,
  response: { 201: productSchema },
  detail: { summary: 'Create a product', description: '...' },
})
```

### 9.2 Calling logAudit with API Key Auth

```typescript
// Example: API key authenticated request — apiKeyId is populated
void logAudit({
  organizationId: organization.id,
  userId: user.id,
  apiKeyId: apiKey?.id,
  authType: _authType,  // 'api_key'
  model: 'SalesOrder',
  operation: 'create',
  args: { data: body },
})
```

### 9.3 Frontend Mutation with Audit Log Invalidation

```typescript
export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateWarehouseInput) => {
      const { data, error } = await api.warehouses.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
```

### 9.4 Frontend Audit Log Page Integration

```typescript
// On the audit logs page, filters are lifted to URL state
function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = {
    model: searchParams.get('model') ?? '',
    operation: searchParams.get('operation') ?? '',
    authType: searchParams.get('authType') ?? '',
  }

  const sortBy = (searchParams.get('sortBy') ?? 'createdAt') as SortColumn
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 50)

  const { data } = useAuditLogs({ ...filters, sortBy, sortOrder, page, pageSize })

  return (
    <>
      <AuditLogsFilters
        filters={filters}
        onFilterChange={(f) => setSearchParams(f)}
      />
      <AuditLogsTable
        logs={data?.data ?? []}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(col) => setSearchParams({ ...filters, sortBy: col })}
      />
    </>
  )
}
```

### 9.5 Edge Cases

- **Audit log write failure**: If the PostgreSQL insert fails (e.g., connection lost), the error is caught and logged via Pino. The parent request still returns successfully. The audit log entry is lost — acceptable given the fire-and-forget design
- **Empty filter values**: When `model`, `operation`, `authType`, or `userId` is not provided or is empty, the service omits that filter from the Prisma `where` clause, returning all records
- **Unknown operation types in table**: If `OperationBadge` receives an operation not in the `styles`/`labels` map, it renders a fallback muted badge with the raw operation string
- **Null userId in table**: When `userId` is null (rare, typically API key auth without user context), the table renders an em-dash (—) in the Pengguna column
- **Null ipAddress**: The `ipAddress` column is currently not populated by `logAudit()` — the table renders an em-dash (—) for null values
- **Hyphenated route prefix**: Eden Treaty requires `api['audit-logs']` bracket notation; a typo like `api.audit-logs` would fail at runtime
- **Large args payload**: The `args` JSONB field can store arbitrarily large payloads. Extremely large payloads may impact query performance on the listing endpoint. Consider adding a payload size limit in the audit logger if this becomes an issue
- **Cross-tenant data leakage**: The `organizationId` index and Prisma `where` clause ensure that audit logs are always scoped to the authenticated organization. No cross-tenant access is possible

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/audit/` with `.route.ts`, `.service.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Read-only API**: Only `GET /audit-logs` endpoint exists; no POST, PATCH, or DELETE
3. **Auth & permissions**: Endpoint uses `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission: { auditLog: ['view'] }`
4. **Serialization**: `createdAt` field returns ISO 8601 string via `serializeAuditLog()`
5. **Pagination**: Endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`; returns `{ data, meta }`
6. **Filtering**: Supports `model`, `operation`, `authType`, `userId` query parameters with AND logic
7. **Audit logger**: `logAudit()` uses raw SQL INSERT with fire-and-forget pattern, errors caught and logged
8. **Cross-module integration**: All 14 backend write modules call `void logAudit(...)`; all 13 frontend mutation hooks invalidate `auditLogKeys.all`
9. **OpenAPI docs**: Endpoint has `detail.summary` and `detail.description`
10. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`
11. **Indonesian UI**: All user-facing text is in Bahasa Indonesia (table headers, operation badges, filter labels)
12. **Immutable logs**: No update or delete endpoints; no soft delete on the `AuditLog` model

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger library: `packages/backend/src/libraries/audit-logger.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Products module spec (template reference): `specs/products/spec-v1.md`
- Backend write modules that depend on `logAudit()`: `packages/backend/src/modules/{products,variants,product-categories,warehouses,stock-movements,suppliers,customers,purchase-orders,sales-orders,members,roles,invitations,api-keys,uploads,sync}/`
- Frontend modules that depend on `auditLogKeys`: `packages/frontend/src/modules/{products,product-categories,warehouses,stock-movements,suppliers,customers,purchase-orders,sales-orders,members,roles,invitations,api-keys,sync}/hooks/`
