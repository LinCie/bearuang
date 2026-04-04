---
title: Warehouses Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: warehouses
tags: [warehouses, crud, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the warehouses domain in BearUang. It covers the **Warehouse** resource — a physical storage location used by stock movements, purchase orders, and sales orders to track where inventory is held. This spec follows the same patterns established by the [Products, Variants & Product Categories Module Specification](../products/spec-v1.md).

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugins, service layer, Prisma models, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components, routes, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Conventions**: file naming, code organization, permission model, hard delete, audit logging
- **Cross-module dependencies**: How stock-movements, purchase-orders, sales-orders, and POS modules depend on warehouses

**Audience**: Developers building new modules or modifying the warehouses domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Resource** | A domain entity exposed via CRUD API endpoints (e.g., Warehouse) |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings before API response |
| **Hard Delete** | Permanently removing the row from the database via `prisma.deleteMany` (no soft-delete) |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for create/edit forms |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: Each module resides in `packages/backend/src/modules/{resource-name}/` with at minimum a `.route.ts` and `.service.ts` file
- **REQ-002**: Route plugins are Elysia instances with `{ prefix: '/resource-name', tags: ['Resource Name'] }`
- **REQ-003**: All route plugins must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { warehouse: ['action'] }` where actions are `view`, `create`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: `serialize*` functions convert Prisma Date types to ISO strings before returning to client
- **REQ-009**: All Prisma queries are scoped by `organizationId`
- **REQ-010**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`

### 3.2 Service Layer

- **REQ-013**: Services are exported as object literals: `export const warehousesService = { async method() {...} }`
- **REQ-014**: List endpoints use `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-015**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-016**: Search uses case-insensitive `contains` on `name` and `address` fields
- **REQ-017**: Hard delete uses `prisma.warehouse.deleteMany` for permanent removal (no `deletedAt`)
- **REQ-018**: `deleteMany` returns a count; routes check `count.count === 0` for 404 responses

### 3.3 Frontend Architecture

- **REQ-019**: Each module resides in `packages/frontend/src/modules/{resource-name}/` with `hooks/`, `components/`, and `index.ts`
- **REQ-020**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-warehouses.ts`
- **REQ-021**: Query key factories are defined in `hooks/use-warehouses.ts` as hierarchical objects
- **REQ-022**: Cache invalidation must target the correct query key scope after mutations
- **REQ-023**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-024**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-md`)
- **REQ-025**: Delete confirmations use shadcn `Dialog`
- **REQ-026**: List pages use `DataTable` (TanStack Table wrapper) with manual sorting, server-side pagination, debounced search
- **REQ-027**: Permission-gated UI via `useHasPermission('warehouse:action')`
- **REQ-028**: All UI text is in Indonesian (Bahasa Indonesia)

### 3.4 Database

- **REQ-029**: The Warehouse model uses UUID v7 primary key (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-030**: The Warehouse model has `organizationId` field with an index for multi-tenant scoping
- **REQ-031**: The Warehouse model does NOT support soft delete — there is no `deletedAt` field
- **REQ-032**: The Warehouse model uses `@@map("warehouse")` for database table naming
- **REQ-033**: Foreign key relations use `onDelete: Restrict` (default) — preventing deletion of warehouses that are referenced by stock movements, purchase orders, or sales orders

### 3.5 Constraints

- **CON-001**: Warehouses use hard delete (permanent removal), not soft delete — deleted warehouses cannot be recovered
- **CON-002**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-003**: Warehouse deletion is permanently destructive — modules that reference a warehouse (stock-movements, purchase-orders, sales-orders) must handle missing warehouse references gracefully
- **CON-004**: The default `pageSize` in the frontend hook is `50`, which differs from the default `10` used in the route page component
- **CON-005**: The Warehouse model has no slug field — naming uniqueness is not enforced at the database level

### 3.6 Guidelines

- **GUD-001**: Prefer `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-002**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-003**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-004**: Types are re-exported from the backend route file through the frontend hook file for single-source-of-truth
- **GUD-005**: Search across both `name` and `address` fields to improve findability

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Warehouses

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/warehouses` | List warehouses (paginated, searchable) | `warehouse:view` | `{ data: Warehouse[], meta: PaginationMeta }` |
| POST | `/warehouses` | Create warehouse | `warehouse:create` | `201 Warehouse` |
| GET | `/warehouses/:id` | Get warehouse detail | `warehouse:view` | `Warehouse` or `404` |
| PATCH | `/warehouses/:id` | Update warehouse | `warehouse:update` | `{ message }` or `404` |
| DELETE | `/warehouses/:id` | Permanently delete warehouse | `warehouse:delete` | `{ message }` or `404` |

### 4.2 Query Parameters (List Endpoint)

```typescript
interface ListWarehousesQuery extends PaginationQuery {
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;  // case-insensitive search on name and address
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

interface ErrorResponse {
  message: string;
}
```

### 4.4 Zod Schema Definitions

#### Warehouse

```typescript
const warehouseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const createWarehouseDto = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateWarehouseDto = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

const listWarehousesQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .extend({
    search: z.string().optional(),
  });

const warehouseIdParam = z.object({
  id: z.string().uuid(),
});
```

#### Frontend Form Validation

```typescript
const warehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama gudang wajib diisi')
    .max(100, 'Nama gudang maksimal 100 karakter'),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat maksimal 500 karakter')
    .optional(),
  isActive: z.boolean(),
});
```

### 4.5 Prisma Model

```prisma
model Warehouse {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  name           String
  address        String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  movements      StockMovement[]
  purchaseOrders PurchaseOrder[]
  salesOrders    SalesOrder[]

  @@index([organizationId])
  @@map("warehouse")
}
```

Key observations about the model:

- **No `deletedAt` field** — warehouses use hard delete, not soft delete
- **No `slug` field** — warehouse names are not slugified; no URL-friendly identifier
- **No unique constraint on `name`** — duplicate warehouse names are allowed within an organization
- **Referenced by**: `StockMovement` (via `warehouseId`), `PurchaseOrder` (via `warehouseId`), `SalesOrder` (via `warehouseId`)

### 4.6 Frontend Query Key Factory

```typescript
export const warehouseKeys = {
  all: ['warehouses'] as const,
  lists: () => [...warehouseKeys.all, 'list'] as const,
  list: (params: ListWarehousesQuery) =>
    [...warehouseKeys.lists(), params] as const,
  details: () => [...warehouseKeys.all, 'detail'] as const,
  detail: (id: string) => [...warehouseKeys.details(), id] as const,
};
```

Note: Unlike the products module, the warehouse keys do not include `trashed()` or `trashedList()` keys because warehouses use hard delete.

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After creating a warehouse:
queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a warehouse:
queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a warehouse:
queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

Note: The delete mutation invalidates `warehouseKeys.all` (broad scope) rather than `warehouseKeys.lists()` to also clear any cached detail views that may reference the deleted warehouse.

### 4.8 Frontend Route Structure

```
_dashboard/
  warehouses/
    route.tsx                    # Layout: <Outlet />
    index.tsx                    # Warehouse list page (DataTable, create button, search)
    $warehouseId.tsx             # Warehouse detail (header, address, info grid)
```

Note: Unlike the products module, there is no `trashed/` sub-route because warehouses use hard delete.

### 4.9 Frontend Component Structure

```
modules/warehouses/
  index.ts                       # Barrel export: hooks + components
  hooks/
    index.ts                     # Re-exports from use-warehouses.ts
    use-warehouses.ts            # Query keys, query hooks, mutation hooks, type re-exports
  components/
    warehouse-form-sheet.tsx     # Sheet form: name (required), address (optional, textarea), isActive (checkbox)
    warehouse-detail-header.tsx  # Header: back link, name, status badge, created/updated dates, edit/delete buttons
    warehouse-states.tsx         # LoadingError state components (WarehouseLoadingState, WarehouseErrorState)
    delete-dialog.tsx            # Confirmation dialog for warehouse deletion
```

### 4.10 Serialization

```typescript
const serializeWarehouse = (w: {
  id: string
  organizationId: string
  name: string
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  ...w,
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
});
```

Note: The warehouse model does not have a `deletedAt` field, so the serialization function only converts `createdAt` and `updatedAt`.

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `warehouse:view` permission, When they `GET /warehouses`, Then they receive a paginated list of warehouses scoped to their organization with serialized Date fields
- **AC-002**: Given an authenticated user with `warehouse:create` permission, When they `POST /warehouses` with valid body, Then the warehouse is created (201) and an audit log entry is written
- **AC-003**: Given a warehouse with existing stock movements, purchase orders, or sales orders, When `DELETE /warehouses/:id` is called, Then the database enforces referential integrity and the delete fails with an appropriate error
- **AC-004**: Given an authenticated user with `warehouse:update` permission, When they `PATCH /warehouses/:id` with valid body, Then the warehouse is updated (200) and an audit log entry is written
- **AC-005**: Given a warehouse that does not exist, When any detail/update/delete endpoint is called with its ID, Then a `404` with `{ message: 'Warehouse not found' }` is returned
- **AC-006**: Given a list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on both `name` and `address`
- **AC-007**: Given a `sortBy` parameter, When a list request is made, Then results are sorted by the specified field in the specified order (default: `createdAt desc`)
- **AC-008**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-009**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-010**: Given the frontend list page, When a user types in the search box, Then after a 300ms debounce the search query is synced to the URL and a server-side fetch is triggered
- **AC-011**: Given the warehouse form sheet, When creating a new warehouse, Then the `name` field is required (min 1, max 100 characters) and `address` is optional (max 500 characters)
- **AC-012**: Given a deleted warehouse, When the list is refreshed, Then the deleted warehouse no longer appears (permanent deletion, no trash/restore)
- **AC-013**: Given the warehouse detail page, When the warehouse has no address, Then a placeholder message with an "add address" link is displayed (visible only to users with `warehouse:update` permission)

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for route handlers using mocked service layer
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `warehouse.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Mock service layer via `mock.module()` for isolated route tests
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404, 422), validation errors, and permission checks
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

### Test Cases Documented in `warehouse.test.ts`

| Endpoint | Test Case | Expected Status |
|----------|-----------|-----------------|
| GET /warehouses | Returns list of warehouses | 200 |
| GET /warehouses/:id | Returns warehouse when it exists | 200 |
| GET /warehouses/:id | Returns 422 for invalid UUID | 422 |
| GET /warehouses/:id | Returns 404 when warehouse does not exist | 404 |
| POST /warehouses | Creates warehouse and returns 201 | 201 |
| POST /warehouses | Returns 422 when name is missing | 422 |
| PATCH /warehouses/:id | Updates warehouse and returns 200 | 200 |
| PATCH /warehouses/:id | Returns 404 when warehouse does not exist | 404 |
| DELETE /warehouses/:id | Deletes warehouse and returns 200 | 200 |
| DELETE /warehouses/:id | Returns 404 when warehouse does not exist | 404 |
| DELETE /warehouses/:id | Returns 422 for invalid UUID | 422 |

## 7. Rationale & Context

### Why Hard Delete Instead of Soft Delete?

Warehouses are structural/organizational entities that represent physical locations. Unlike products or variants that carry business history (transactions, sales), warehouses are simpler reference data. A warehouse with existing references (stock movements, orders) is protected by database referential integrity, preventing accidental deletion. When a warehouse can safely be deleted (no references exist), permanent removal keeps the data clean without accumulating tombstone records. This is a deliberate simplification compared to the products module's soft-delete approach.

### Why No Slug Field?

Warehouses do not appear in public URLs or customer-facing contexts. They are internal organizational entities selected via Combobox or referenced by UUID in the API. A slug field would add unnecessary complexity without providing user-facing value.

### Why No Name Uniqueness Constraint?

Organizations may legitimately have multiple warehouses with similar names (e.g., "Gudang Utama" across different cities). The combination of UUID primary key and frontend disambiguation (via address display) is sufficient for identification. If uniqueness is needed in the future, a composite unique constraint on `(organizationId, name)` can be added via migration.

### Why Is the Edit Button Gated by `warehouse:update` but the Delete Button Is Not?

The `WarehouseDetailHeader` component gates the edit button with `useHasPermission('warehouse:update')` but does not gate the delete button. This is an implementation detail that may represent an oversight or an intentional design where deletion is available to all authenticated users. Backend permission enforcement on `DELETE /warehouses/:id` (which requires `warehouse:delete`) remains the authoritative guard.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience, consistent with the products module convention.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all warehouse data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies (Modules That Depend on Warehouses)

| Module | Relationship | Description |
|--------|-------------|-------------|
| **Stock Movements** | `StockMovement.warehouseId -> Warehouse.id` | Every stock movement (IN, OUT, ADJUSTMENT) is associated with a warehouse. The stock-movements module validates warehouse existence before creating movements and supports filtering by `warehouseId`. |
| **Purchase Orders** | `PurchaseOrder.warehouseId -> Warehouse.id` | Every purchase order is associated with a destination warehouse. The purchase-orders module validates warehouse existence before creating/updating orders and supports filtering by `warehouseId`. |
| **Sales Orders** | `SalesOrder.warehouseId -> Warehouse.id` | Every sales order is associated with a source warehouse. The sales-orders module validates warehouse existence before creating/updating orders and supports filtering by `warehouseId`. |
| **POS (Sync)** | `sync.route.ts` references `warehouseId` | The POS offline sync module references `warehouseId` when syncing data, indicating that POS transactions are warehouse-scoped. |

### Data Dependencies (Modules That Warehouses Depends On)

| Module | Relationship | Description |
|--------|-------------|-------------|
| **Audit Logs** | Implicit via `void logAudit(...)` | Write operations on warehouses generate audit log entries. The `auditLogKeys.all` query key is invalidated on the frontend after warehouse mutations. |

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation, optimistic updates)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe params
- **PLT-005**: **TanStack Table** - Headless table utility for data grids
- **PLT-006**: **shadcn/ui + Radix** - UI component primitives

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
export const warehousesRoute = new Elysia({
  prefix: '/warehouses',
  tags: ['Warehouses'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, search, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await warehousesService.listWarehouses(
      organization.id,
      {
        skip,
        take,
        search,
        orderBy: sortBy
          ? { field: sortBy, order: sortOrder ?? 'desc' }
          : undefined,
      },
    )
    return {
      data: data.map(serializeWarehouse),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { warehouse: ['view'] },
    query: listWarehousesQuery,
    response: { 200: paginatedResponse(warehouseSchema) },
    detail: {
      summary: 'List warehouses',
      description:
        'Retrieves a paginated list of all warehouses belonging to the authenticated organization.',
    },
  })
  // ... POST, GET /:id, PATCH /:id, DELETE /:id follow the same pattern
```

### 9.2 Backend Service

```typescript
export const warehousesService = {
  async listWarehouses(organizationId: string, params?: ListParams) {
    const where = {
      organizationId,
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { address: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.warehouse.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.warehouse.count({ where }),
    ])
    return { data, total }
  },

  async deleteWarehouse(organizationId: string, id: string) {
    return prisma.warehouse.deleteMany({
      where: { id, organizationId },
    })
  },
}
```

### 9.3 Frontend Hook

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

### 9.4 Edge Cases

- **Deletion with existing references**: Deleting a warehouse that is referenced by `StockMovement`, `PurchaseOrder`, or `SalesOrder` records will fail at the database level due to foreign key constraints. The consuming modules (stock-movements, purchase-orders, sales-orders) each perform a `findFirst` validation on the warehouse before creating records, returning an error message like `'Warehouse not found'` when the warehouse does not exist.
- **Duplicate warehouse names**: The Warehouse model does not enforce name uniqueness. An organization can create multiple warehouses with the same name. Frontend disambiguation relies on the address field displayed beneath the name in the data table.
- **Empty address**: Warehouses can be created without an address. The detail page shows a placeholder message ("Belum ada alamat tercatat untuk gudang ini.") with a contextual "Tambahkan alamat" link for users with `warehouse:update` permission.
- **Default page size discrepancy**: The frontend `useWarehouses` hook defaults to `pageSize: 50`, while the list page component initializes pagination with `pageSize: 10`. Both values are valid; the page component's initial state takes precedence.
- **Delete button permission inconsistency**: The `WarehouseDetailHeader` component does not gate the delete button behind `useHasPermission('warehouse:delete')`, but the edit button is gated behind `useHasPermission('warehouse:update')`. The backend enforces the `warehouse:delete` permission on the API, so unauthorized deletion is still prevented.
- **Hard delete is irreversible**: Unlike the products module which supports soft delete and restore, warehouse deletion is permanent. There is no trashed view or restore endpoint. This is a deliberate architectural choice — see section 7 rationale.

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/warehouses/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`
3. **Serialization**: All Date fields return ISO 8601 strings
4. **Hard delete**: DELETE permanently removes the warehouse; no trashed/restore flow
5. **Pagination**: List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder`, `search`; return `{ data, meta }`
6. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`
9. **Cache invalidation**: Mutations invalidate the correct query key scopes including `auditLogKeys.all`
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **Permission guards**: Create/edit UI elements gated by `useHasPermission`
12. **Cross-module integrity**: Deletion is prevented by database foreign key constraints when references exist

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Products, Variants & Product Categories Module Specification: `specs/products/spec-v1.md` — reference template for this spec; documents the soft-delete pattern that warehouses deliberately does not follow
- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- Stock Movements module: `packages/backend/src/modules/stock-movements/` — primary consumer of warehouse references
- Purchase Orders module: `packages/backend/src/modules/purchase-orders/` — references warehouse as destination
- Sales Orders module: `packages/backend/src/modules/sales-orders/` — references warehouse as source
- POS sync: `packages/backend/src/modules/sync/sync.route.ts` — references warehouse in sync operations
