---
title: Stock Movements Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: stock-movements
tags: [stock-movements, inventory, stock, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the stock movements domain in BearUang. The stock movements module is the **single writer** for the denormalized `ProductVariant.stock` field. Every stock adjustment — whether from manual entry, purchase order receiving, or sales order fulfillment — must flow through this module to guarantee inventory consistency.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, Prisma model, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components, routes, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Stock management invariants**: Atomic stock updates, movement reversal on delete, type-based delta computation
- **Dependencies**: Integration with products/variants and warehouses modules

**Audience**: Developers building inventory-related features or modifying the stock movements domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui. The reader has read the [Products Specification](../products/spec-v1.md) for context on variants and the denormalized stock field.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Stock Movement** | A record of a stock change (IN, OUT, or ADJUSTMENT) tied to a specific variant, warehouse, and organization |
| **Stock Delta** | The signed integer applied to `ProductVariant.stock`: positive for IN, negative for OUT, positive for ADJUSTMENT |
| **Single Writer** | The `stockMovementService` is the only code path that modifies `ProductVariant.stock`; all other modules must call it |
| **Movement Type** | One of `IN` (stock received), `OUT` (stock dispatched), or `ADJUSTMENT` (stock correction) |
| **Reference** | An optional link from a movement to its source record (e.g., `purchase_order`, `sales_order`) via `referenceId` and `referenceType` |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app; hyphenated routes require bracket notation: `api['stock-movements']` |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for the create movement form |
| **Combobox** | A searchable dropdown component used for selecting warehouses and variants |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for stock movements |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The module resides in `packages/backend/src/modules/stock-movements/` with a `.route.ts` and `.service.ts` file
- **REQ-002**: Route plugin is an Elysia instance with `{ prefix: '/stock-movements', tags: ['Stock Movements'] }`
- **REQ-003**: Route plugin uses `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint declares `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { stock: ['view'] }` or `{ stock: ['adjust'] }` — the `stock` resource uses `view` and `adjust` actions (not `create`/`update`/`delete`)
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for the `createdAt` field (ISO 8601 string)
- **REQ-008**: The response schema includes relations (`variant`, `warehouse`) as nested objects with selected fields
- **REQ-009**: The `serializeMovement` function converts Prisma `Date` to ISO string before returning to client
- **REQ-010**: All Prisma queries are scoped by `organizationId`; stock movements do not use soft delete
- **REQ-011**: All write operations call `void logAudit(...)` with `model: 'StockMovement'`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: Not-found scenarios return `404` with `{ message: string }`

### 3.2 Service Layer

- **REQ-014**: Service is exported as object literal: `export const stockMovementService = { async method() {...} }`
- **REQ-015**: List endpoint uses `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-016**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-017**: Search is case-insensitive `contains` on `note`, `variant.name`, and `variant.sku`
- **REQ-018**: Sorting is limited to `createdAt`, `quantity`, and `type` fields
- **REQ-019**: Stock movements do not support soft delete — `DELETE` is a hard delete that reverses the stock delta
- **REQ-020**: `createMovement` uses `prisma.$transaction` to atomically create the movement record and increment variant stock
- **REQ-021**: `deleteMovement` uses `prisma.$transaction` to atomically delete the movement record and reverse the stock delta
- **REQ-022**: Stock delta computation: IN = `+quantity`, OUT = `-quantity`, ADJUSTMENT = `+quantity`

### 3.3 Frontend Architecture

- **REQ-023**: Module resides in `packages/frontend/src/modules/stock-movements/` with `hooks/`, `components/`, and `index.ts`
- **REQ-024**: TanStack Query hooks wrap Eden Treaty API calls using bracket notation: `api['stock-movements']`
- **REQ-025**: Query key factory is defined inline in `hooks/use-stock-movements.ts` as `stockMovementKeys`
- **REQ-026**: Cache invalidation targets `stockMovementKeys`, `variantKeys`, and `auditLogKeys` after mutations
- **REQ-027**: Create form uses shadcn `Sheet` component (slide-over, `sm:max-w-md`) with TanStack Form + Zod validation
- **REQ-028**: Delete confirmation uses shadcn `AlertDialog`
- **REQ-029**: List page uses `DataTable` (TanStack Table wrapper) with manual sorting, server-side pagination, debounced search
- **REQ-030**: Permission-gated UI via `useHasPermission('stock:adjust')` for create and delete buttons
- **REQ-031**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-032**: Dates formatted with `id-ID` locale
- **REQ-033**: Stock movements are immutable records — edit functionality is not supported; only create and delete
- **REQ-034**: URL search params (`warehouseId`, `variantId`, `search`) enable deep-linking from other modules (e.g., navigating from a warehouse detail to its movements)

### 3.4 Database

- **REQ-035**: The `StockMovement` model uses UUID v7 primary key (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-036**: The model has `organizationId` field with an index for multi-tenant scoping
- **REQ-037**: The model does not use soft delete — movements are hard-deleted with stock reversal
- **REQ-038**: The model uses `@@map("stock_movement")` for database table naming
- **REQ-039**: Indexes exist on `warehouseId`, `variantId`, and `referenceId` for common filter queries
- **REQ-040**: The `StockMovementType` enum maps to `@@map("stock_movement_type")` with values `IN`, `OUT`, `ADJUSTMENT`
- **REQ-041**: `referenceId` and `referenceType` are nullable optional fields for linking movements to source documents

### 3.5 Constraints

- **CON-001**: Hyphenated route name requires bracket notation in Eden client: `api['stock-movements']`
- **CON-002**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-003**: Stock movements are the **only** path to modify `ProductVariant.stock` — no other service or module may write to this field directly
- **CON-004**: ADJUSTMENT type always applies a positive delta — to reduce stock via adjustment, use OUT type
- **CON-005**: No validation prevents stock from going negative — `prisma.$transaction` with `{ increment: stockDelta }` allows negative values
- **CON-006**: Stock movements do not have an `updatedAt` field — they are append-only immutable records
- **CON-007**: The delete operation reverses the stock delta using the stored movement type and quantity, so deleting an old movement adjusts current stock (not the stock at the time of the original movement)

### 3.6 Guidelines

- **GUD-001**: Use `paginatedResponse(schema)` from `#common/pagination` for list response shapes
- **GUD-002**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-003**: Prefer `findUniqueOrThrow` over `findUnique` with manual null check when the record must exist
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: When linking to stock movements from other modules, pass `warehouseId` and/or `variantId` as URL search params for pre-filtering

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/stock-movements` | List stock movements (paginated, searchable, filterable by variant, warehouse, type, reference) | `stock:view` | `{ data: StockMovementWithRelations[], meta: PaginationMeta }` |
| POST | `/stock-movements` | Create a stock movement (atomically updates variant stock) | `stock:adjust` | `201 StockMovementWithRelations` |
| GET | `/stock-movements/:id` | Get a single stock movement with variant and warehouse relations | `stock:view` | `StockMovementWithRelations` or `404` |
| DELETE | `/stock-movements/:id` | Delete a stock movement (atomically reverses its effect on variant stock) | `stock:adjust` | `{ message }` or `404` |

### 4.2 Query Parameters (List Endpoint)

```typescript
interface ListMovementsQuery extends PaginationQuery {
  variantId?: string;       // Filter by variant UUID
  warehouseId?: string;     // Filter by warehouse UUID
  type?: StockMovementType; // Filter by movement type (IN, OUT, ADJUSTMENT)
  referenceId?: string;     // Filter by reference UUID
  referenceType?: string;   // Filter by reference type (e.g., "purchase_order")
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

#### Stock Movement (Response)

```typescript
const movementTypeEnum = z.enum(['IN', 'OUT', 'ADJUSTMENT'])

const stockMovementSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  variantId: z.string(),
  type: movementTypeEnum,
  quantity: z.number(),
  referenceId: z.string().nullable(),
  referenceType: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

const stockMovementWithRelationsSchema = stockMovementSchema.extend({
  variant: z.object({ id: z.string(), sku: z.string(), name: z.string() }),
  warehouse: z.object({ id: z.string(), name: z.string() }),
})
```

#### Create Movement (Request Body)

```typescript
const createMovementDto = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().positive(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  note: z.string().optional(),
})
```

#### List Movements (Query Parameters)

```typescript
const listMovementsQuery = paginationQuery
  .merge(sortQuery(['createdAt', 'quantity', 'type']))
  .extend({
    search: z.string().optional(),
    variantId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    type: movementTypeEnum.optional(),
    referenceId: z.string().optional(),
    referenceType: z.string().optional(),
  })
```

#### Frontend Form Validation

```typescript
const stockMovementSchema = z.object({
  warehouseId: z.string().min(1, 'Gudang wajib dipilih'),
  variantId: z.string().min(1, 'Varian produk wajib dipilih'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(1, 'Kuantitas minimal 1'),
  note: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
})
```

### 4.5 Prisma Models

```prisma
enum StockMovementType {
  IN
  OUT
  ADJUSTMENT

  @@map("stock_movement_type")
}

model StockMovement {
  id             String            @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  warehouseId    String            @db.Uuid
  warehouse      Warehouse         @relation(fields: [warehouseId], references: [id])
  variantId      String            @db.Uuid
  variant        ProductVariant    @relation(fields: [variantId], references: [id])
  type           StockMovementType
  quantity       Int
  referenceId    String?
  referenceType  String?
  note           String?
  createdAt      DateTime          @default(now())

  @@index([organizationId])
  @@index([warehouseId])
  @@index([variantId])
  @@index([referenceId])
  @@map("stock_movement")
}
```

The `ProductVariant.stock` field referenced by this module:

```prisma
model ProductVariant {
  // ...
  /// Denormalized cache — managed exclusively by StockMovement service. Never write directly.
  stock          Int       @default(0)
  // ...
  movements          StockMovement[]
  // ...
}
```

### 4.6 Frontend Query Key Factory

```typescript
export const stockMovementKeys = {
  all: ['stock-movements'] as const,
  lists: () => [...stockMovementKeys.all, 'list'] as const,
  list: (params: ListMovementsQuery) => [...stockMovementKeys.lists(), params] as const,
  details: () => [...stockMovementKeys.all, 'detail'] as const,
  detail: (id: string) => [...stockMovementKeys.details(), id] as const,
  byVariant: (variantId: string) => [...stockMovementKeys.all, 'byVariant', variantId] as const,
  byWarehouse: (warehouseId: string) => [...stockMovementKeys.all, 'byWarehouse', warehouseId] as const,
  byReference: (referenceId: string, referenceType: string) =>
    [...stockMovementKeys.all, 'byReference', referenceType, referenceId] as const,
}
```

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After creating a stock movement:
queryClient.invalidateQueries({ queryKey: stockMovementKeys.lists() })
queryClient.invalidateQueries({ queryKey: stockMovementKeys.byVariant(variables.variantId) })
queryClient.invalidateQueries({ queryKey: stockMovementKeys.byWarehouse(variables.warehouseId) })
queryClient.invalidateQueries({ queryKey: variantKeys.detail(variables.variantId) })
queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })

// After deleting a stock movement:
queryClient.invalidateQueries({ queryKey: stockMovementKeys.all })
queryClient.invalidateQueries({ queryKey: variantKeys.all })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
```

### 4.8 Frontend Route Structure

```
_dashboard/
  stock-movements/
    index.tsx                    # List page: DataTable, filters, create button, delete dialog
    $movementId.tsx              # Detail page: header, summary, product info, warehouse info, reference, notes, metadata
```

### 4.9 Frontend Component Structure

```
modules/stock-movements/
  index.ts                       # Barrel export for hooks and components
  hooks/
    index.ts                     # Re-exports types and hooks
    use-stock-movements.ts       # All query keys, query hooks, and mutation hooks
  components/
    index.ts                     # Barrel export for all components
    stock-movements-table.tsx     # Table component with type badges, sort buttons, reference links
    stock-movements-filters.tsx   # Filter bar: search input, warehouse/variant Comboboxes, type Select, active filter badges
    stock-movement-form-sheet.tsx # Sheet form: warehouse Combobox, product Combobox, variant Combobox, type Select, quantity, note
    movement-detail-header.tsx    # Detail header: back button, type badge, ID, timestamp, edit/delete actions
    delete-dialog.tsx             # AlertDialog for delete confirmation
    movement-loading-state.tsx    # Loading skeleton with animated bear icon
    movement-error-state.tsx      # Error state with retry button
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `stock:view` permission, When they `GET /stock-movements`, Then they receive a paginated list of stock movements scoped to their organization with serialized Date fields and included variant/warehouse relations
- **AC-002**: Given an authenticated user with `stock:adjust` permission, When they `POST /stock-movements` with valid body, Then a movement is created (201), `ProductVariant.stock` is atomically incremented/decremented, and an audit log entry is written
- **AC-003**: Given an authenticated user with `stock:adjust` permission, When they `DELETE /stock-movements/:id`, Then the movement is hard-deleted (200), the stock delta is atomically reversed on the variant, and an audit log entry is written
- **AC-004**: Given a movement that does not exist, When `GET /stock-movements/:id` or `DELETE /stock-movements/:id` is called, Then a `404` is returned
- **AC-005**: Given the list endpoint, When `variantId`, `warehouseId`, `type`, `referenceId`, or `referenceType` query parameters are provided, Then results are filtered accordingly
- **AC-006**: Given the list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on `note`, `variant.name`, and `variant.sku`
- **AC-007**: Given an IN movement with quantity 10, When created, Then the variant stock increases by 10; when deleted, Then the variant stock decreases by 10
- **AC-008**: Given an OUT movement with quantity 5, When created, Then the variant stock decreases by 5; when deleted, Then the variant stock increases by 5
- **AC-009**: Given an ADJUSTMENT movement with quantity 3, When created, Then the variant stock increases by 3; when deleted, Then the variant stock decreases by 3
- **AC-010**: Given an invalid movement type (e.g., `TRANSFER`), When a POST request is made, Then a `422` validation error is returned
- **AC-011**: Given a quantity of zero or negative, When a POST request is made, Then a `422` validation error is returned
- **AC-012**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-013**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-014**: Given the frontend list page, When a user selects a warehouse or variant filter, Then the query parameters are updated and movements are filtered accordingly
- **AC-015**: Given the frontend list page, When a user types in the search box, Then after a 300ms debounce the search query triggers a server-side fetch
- **AC-016**: Given the frontend list page, When a movement has a `referenceType` of `purchase_order` or `sales_order`, Then the reference ID is rendered as a clickable link to the corresponding order detail page
- **AC-017**: Given the stock movements page is accessed with `warehouseId` or `variantId` URL search params (e.g., from a warehouse detail page), Then the filters are pre-selected and the Combobox for that filter is hidden

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods using mocked Elysia route handlers via `app.handle(new Request(...))` pattern
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `stock-movements.test.ts` in the module directory
- **Test Data Management**: Mock service with `mock.module` for isolated route-level testing
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths (list, create, get, delete), error paths (404, 422), validation (invalid type, zero quantity, missing required fields), filter acceptance
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

### Backend Test Coverage

| Endpoint | Test Cases |
|----------|-----------|
| `GET /stock-movements` | Returns list; accepts valid query filters (`type`, `warehouseId`, `variantId`); returns 422 for invalid type |
| `GET /stock-movements/:id` | Returns movement when exists; returns 404 when not found; returns 422 for invalid UUID |
| `POST /stock-movements` | Creates movement with 201; returns 422 for missing required fields; returns 422 for quantity of zero; returns 422 for invalid type (`TRANSFER`) |
| `DELETE /stock-movements/:id` | Deletes movement with 200; returns 404 when not found; returns 422 for invalid UUID |

## 7. Rationale & Context

### Why Single Writer for Variant Stock?

`ProductVariant.stock` is a denormalized cache of the computed stock level. By routing all stock changes through the `stockMovementService`, the system guarantees that every stock adjustment is recorded as an immutable audit trail. The Prisma doc comment `/// Denormalized cache — managed exclusively by StockMovement service. Never write directly.` enforces this contract at the schema level. This pattern enables fast stock lookups (critical for POS barcode scanning) while maintaining full traceability.

### Why Hard Delete with Stock Reversal?

Unlike products and categories which use soft delete, stock movements are append-only immutable records. When a movement is deleted, the stock delta is reversed atomically in the same transaction. This ensures the variant stock always reflects the net sum of all existing movements. Hard delete is appropriate because movements have no dependent children and their deletion semantics (reverse the effect) are well-defined.

### Why Atomic Transactions?

Both `createMovement` and `deleteMovement` use `prisma.$transaction` with `Promise.all` inside the callback. This guarantees that the movement record and the stock update happen atomically — if either fails, both are rolled back. This prevents phantom stock inconsistencies from partial writes.

### Why `stock:adjust` Instead of `stock:create`?

The stock permission model uses `adjust` rather than `create`/`update`/`delete` to reflect the business intent. Stock adjustments are a privileged operation that directly impacts inventory accuracy. Using a single `adjust` permission for both creating and deleting movements simplifies the permission model while keeping the operation gated behind appropriate access control.

### Why No Update Endpoint?

Stock movements are immutable records. If a correction is needed, the original movement is deleted (reversing its effect) and a new movement is created. This preserves the full audit trail and prevents ambiguity about what changed and when.

### Why Reference Linking?

The `referenceId` and `referenceType` fields enable linking movements to their source documents (purchase orders, sales orders). This creates a traceable chain: a purchase order receipt creates IN movements, a sales order dispatch creates OUT movements. The frontend renders these as clickable links to the corresponding order detail pages.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all stock movement data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **ProductVariant** - The target of stock adjustments; `stock` field is denormalized and managed exclusively by this module. See [Products Specification](../products/spec-v1.md).
- **DAT-002**: **Warehouse** - Required foreign key on every stock movement; movements are scoped to a warehouse. See warehouses module.
- **DAT-003**: **PurchaseOrder / PurchaseOrderItem** - Source of IN movements when receiving goods. May set `referenceId` and `referenceType: 'purchase_order'`.
- **DAT-004**: **SalesOrder / SalesOrderItem** - Source of OUT movements when dispatching goods. May set `referenceId` and `referenceType: 'sales_order'`.
- **DAT-005**: **AuditLog** - All write operations (create, delete) are logged with user identity and operation details.

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management and atomic transactions
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe search params
- **PLT-005**: **TanStack Table** - Headless table utility for data grids
- **PLT-006**: **TanStack Form** - Form state management with Zod validation
- **PLT-007**: **shadcn/ui + Radix** - UI component primitives (Sheet, AlertDialog, Combobox, Select, DataTable)

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { stockMovementService } from './stock-movements.service'
import { StockMovementType as PrismaStockMovementType } from '#generated/prisma/client'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const movementTypeEnum = z.enum([
  PrismaStockMovementType.IN,
  PrismaStockMovementType.OUT,
  PrismaStockMovementType.ADJUSTMENT,
])

export const stockMovementWithRelationsSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  variantId: z.string(),
  type: movementTypeEnum,
  quantity: z.number(),
  referenceId: z.string().nullable(),
  referenceType: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  variant: z.object({ id: z.string(), sku: z.string(), name: z.string() }),
  warehouse: z.object({ id: z.string(), name: z.string() }),
})

export const createMovementDto = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().positive(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  note: z.string().optional(),
})

export const stockMovementRoute = new Elysia({
  prefix: '/stock-movements',
  tags: ['Stock Movements'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await stockMovementService.listMovements(
      organization.id,
      {
        skip, take,
        variantId: query.variantId,
        warehouseId: query.warehouseId,
        type: query.type,
        referenceId: query.referenceId,
        referenceType: query.referenceType,
        search: query.search,
        orderBy: sortBy ? { field: sortBy, order: sortOrder ?? 'desc' } : undefined,
      },
    )
    return {
      data: data.map(serializeMovement),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { stock: ['view'] },
    query: listMovementsQuery,
    response: { 200: paginatedResponse(stockMovementWithRelationsSchema) },
    detail: {
      summary: 'List stock movements',
      description: 'Retrieves a paginated list of stock movements. Supports filtering by variant, warehouse, type, and reference.',
    },
  })
```

### 9.2 Backend Service

```typescript
import { prisma } from '#integrations/prisma'
import { StockMovementType } from '#generated/prisma/client'

export const stockMovementService = {
  async createMovement(organizationId: string, data: {
    warehouseId: string
    variantId: string
    type: StockMovementType
    quantity: number
    referenceId?: string
    referenceType?: string
    note?: string
  }) {
    return prisma.$transaction(async (tx) => {
      const stockDelta =
        data.type === StockMovementType.IN
          ? data.quantity
          : data.type === StockMovementType.OUT
            ? -data.quantity
            : data.quantity

      const [movement] = await Promise.all([
        tx.stockMovement.create({
          data: { ...data, organizationId },
          include: {
            variant: { select: { id: true, sku: true, name: true } },
            warehouse: { select: { id: true, name: true } },
          },
        }),
        tx.productVariant.updateMany({
          where: { id: data.variantId, organizationId },
          data: { stock: { increment: stockDelta } },
        }),
      ])

      return movement
    })
  },

  async deleteMovement(organizationId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findFirst({
        where: { id, organizationId },
      })
      if (!movement) return null

      const stockDelta =
        movement.type === StockMovementType.IN
          ? -movement.quantity
          : movement.type === StockMovementType.OUT
            ? movement.quantity
            : -movement.quantity

      await Promise.all([
        tx.stockMovement.delete({ where: { id } }),
        tx.productVariant.updateMany({
          where: { id: movement.variantId, organizationId },
          data: { stock: { increment: stockDelta } },
        }),
      ])

      return movement
    })
  },
}
```

### 9.3 Frontend Hook

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#lib/api'
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'
import { variantKeys } from '#modules/products/hooks/use-variants'

export function useCreateStockMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMovementInput) => {
      const { data, error } = await api['stock-movements'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.lists() })
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.byVariant(variables.variantId) })
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.byWarehouse(variables.warehouseId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variables.variantId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
```

### 9.4 Edge Cases

- **Stock going negative**: An OUT movement or adjustment reversal can drive `ProductVariant.stock` below zero. The system does not enforce non-negative stock because stock-out scenarios are a valid business state (backorders, overselling). The frontend does not prevent this but displays negative stock in red for visibility.
- **Concurrent movements on the same variant**: Two simultaneous `createMovement` calls for the same variant use Prisma's `{ increment: stockDelta }` which is atomic at the database level. PostgreSQL's row-level locking within `$transaction` prevents lost updates.
- **Deleting a movement that was already compensated**: If a movement was created, then a compensating adjustment was made, deleting the original movement reverses its delta again — which may result in double-counting. Users should be aware that delete reverses the effect, not undo the history.
- **ADJUSTMENT always adds stock**: Both IN and ADJUSTMENT apply a positive delta. To reduce stock without a source document, users should use OUT type. This simplifies the delta computation logic.
- **Pre-filtered views from other modules**: When navigating from a warehouse detail page to stock movements, `warehouseId` is passed as a URL search param. The warehouse Combobox filter is hidden (`preselectedWarehouseId` is set) to prevent accidental filter removal. The same applies for `variantId` when navigating from a variant detail page.
- **Reference linking for order modules**: The `referenceId` and `referenceType` fields are optional. When `referenceType` is `purchase_order` or `sales_order`, the frontend renders the reference as a clickable link to the corresponding order detail page. For other or unknown `referenceType` values, only the truncated ID is displayed.
- **Movement type badge colors**: IN movements use emerald (green), OUT use rose (red), and ADJUSTMENT use amber (yellow) badges — consistent across the list table and detail header.
- **Immutable records**: Stock movements do not support editing. The detail page has an edit button (gated by `stock:adjust` permission) but the handler is a no-op placeholder. Only create and delete are supported operations.

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/stock-movements/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission` with `stock:view` or `stock:adjust`
3. **Serialization**: `createdAt` field returns ISO 8601 string; relations are included in response
4. **Hard delete with reversal**: DELETE removes the record and reverses the stock delta atomically within a transaction
5. **Pagination**: List endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `variantId`, `warehouseId`, `type`, `referenceId`, `referenceType`; returns `{ data, meta }`
6. **Audit logging**: Create and delete operations call `void logAudit(...)` with correct model (`StockMovement`), operation, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `byVariant(id)`, `byWarehouse(id)`, `byReference(id, type)`
9. **Cache invalidation**: Create mutation invalidates stock movement lists, variant lists/details, and audit logs; delete mutation invalidates all stock movement and variant keys
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia (e.g., "Pergerakan Stok", "Masuk", "Keluar", "Penyesuaian", "Catat Pergerakan")
11. **Permission guards**: Create button and edit/delete actions gated by `useHasPermission('stock:adjust')`
12. **Single writer invariant**: No code path outside `stockMovementService` writes to `ProductVariant.stock`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Products specification (variant dependency): `specs/products/spec-v1.md`
- Warehouses module: `packages/backend/src/modules/warehouses/`
- Purchase orders module: `packages/backend/src/modules/purchase-orders/`
- Sales orders module: `packages/backend/src/modules/sales-orders/`
- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- Combobox component: `packages/frontend/src/components/ui/combobox.tsx`
