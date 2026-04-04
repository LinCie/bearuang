---
title: Suppliers Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: suppliers
tags: [suppliers, crud, elysia, prisma, react, tanstack, purchase-orders]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the suppliers domain in BearUang. It covers a single resource: **Suppliers**. Suppliers represent vendors and business partners from whom the organization purchases inventory. This spec follows the same patterns established by the products module specification.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, Prisma model, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components, routes, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Conventions**: file naming, code organization, permission model, audit logging
- **Relationships**: Dependency on the purchase-orders module (suppliers are referenced by purchase orders)

**Audience**: Developers building new modules or modifying the suppliers domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Resource** | A domain entity exposed via CRUD API endpoints (e.g., Supplier) |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings before API response |
| **Hard Delete** | Permanently removing the row from the database (suppliers do not use soft delete) |
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
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { resource: ['action'] }` where actions are `view`, `create`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: `serialize*` functions convert Prisma Date types to ISO strings before returning to client
- **REQ-009**: All Prisma queries are scoped by `organizationId`
- **REQ-010**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`

### 3.2 Service Layer

- **REQ-013**: Services are exported as object literals: `export const {resourceName}Service = { async method() {...} }`
- **REQ-014**: List endpoints use `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-015**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-016**: Search uses case-insensitive `contains` on relevant text fields (name, email, phone, address)
- **REQ-017**: Delete uses `prisma.supplier.delete({ where: { id } })` — hard delete, not soft delete
- **REQ-018**: Service methods perform existence checks (findFirst by `id` + `organizationId`) before update/delete and return `null` when not found

### 3.3 Frontend Architecture

- **REQ-019**: Each module resides in `packages/frontend/src/modules/{resource-name}/` with `hooks/`, `components/`, and `index.ts`
- **REQ-020**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-{resource-name}.ts`
- **REQ-021**: Query key factories are defined in `hooks/use-{resource-name}.ts` as hierarchical objects (co-located, not in a separate file)
- **REQ-022**: Cache invalidation must target the correct query key scope after mutations
- **REQ-023**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-024**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-md`)
- **REQ-025**: Delete confirmations use shadcn `Dialog`
- **REQ-026**: List pages use `DataTable` (TanStack Table wrapper) with manual sorting, server-side pagination, debounced search (300ms)
- **REQ-027**: Permission-gated UI via `useHasPermission('supplier:action')`
- **REQ-028**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-029**: Dates formatted with `id-ID` locale

### 3.4 Database

- **REQ-030**: The Supplier model uses UUID v7 primary keys (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-031**: The Supplier model has `organizationId` field with an index for multi-tenant scoping
- **REQ-032**: The Supplier model does NOT support soft delete — there is no `deletedAt` field
- **REQ-033**: The Supplier model uses `@@map("supplier")` for database table naming
- **REQ-034**: The Supplier model has a one-to-many relation with `PurchaseOrder` via `supplierId`

### 3.5 Constraints

- **CON-001**: Suppliers use hard delete (`prisma.supplier.delete`), not soft delete — deleted suppliers cannot be restored
- **CON-002**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-003**: Suppliers referenced by existing `PurchaseOrder` records cannot be deleted at the database level due to the foreign key constraint (no `onDelete` action specified — defaults to restrict)
- **CON-004**: The `updateSupplierDto` uses `.nullable()` on optional contact fields (`email`, `phone`, `address`) to allow explicitly clearing them by sending `null`
- **CON-005**: The `listSuppliersQuery` uses a string-to-boolean transform for `isActive` (`z.string().transform(v => v === 'true').pipe(z.boolean())`) because query parameters arrive as strings

### 3.6 Guidelines

- **GUD-001**: Prefer `findFirst` with `organizationId` scoping over `findUnique` for multi-tenant queries
- **GUD-002**: Use `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-003**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: When a supplier has associated purchase orders, consider adding a soft-delete mechanism or archiving pattern in a future iteration to prevent accidental data loss

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Suppliers

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/suppliers` | List suppliers (paginated, searchable, filterable by active status) | `supplier:view` | `{ data: Supplier[], meta: PaginationMeta }` |
| POST | `/suppliers` | Create supplier | `supplier:create` | `201 Supplier` |
| GET | `/suppliers/:id` | Get supplier detail | `supplier:view` | `Supplier` or `404` |
| PATCH | `/suppliers/:id` | Update supplier | `supplier:update` | `Supplier` or `404` |
| DELETE | `/suppliers/:id` | Permanently delete supplier | `supplier:delete` | `{ message }` or `404` |

### 4.2 Query Parameters (List Endpoint)

```typescript
interface ListSuppliersQuery extends PaginationQuery {
  search?: string;    // case-insensitive search on name, email, phone, address
  isActive?: boolean; // filter by active status (string "true"/"false" transformed to boolean)
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
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

#### Supplier

```typescript
const supplierSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const createSupplierDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const updateSupplierDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
```

#### Frontend Form Validation (SupplierFormSheet)

```typescript
const supplierFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama pemasok wajib diisi').max(100, 'Nama pemasok maksimal 100 karakter'),
  email: z.union([z.string().email('Format email tidak valid'), z.literal('')]),
  phone: z.string().max(20, 'Nomor telepon maksimal 20 karakter'),
  address: z.string().max(500, 'Alamat maksimal 500 karakter'),
  isActive: z.boolean(),
});
```

### 4.5 Prisma Model

```prisma
model Supplier {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  name           String
  email          String?
  phone          String?
  address        String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  purchaseOrders PurchaseOrder[]

  @@index([organizationId])
  @@map("supplier")
}
```

### 4.6 Frontend Query Key Factory

```typescript
// suppliers/hooks/use-suppliers.ts
export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (params: ListSuppliersQuery) => [...supplierKeys.lists(), params] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
};
```

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After creating a supplier:
queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a supplier:
queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a supplier:
queryClient.invalidateQueries({ queryKey: supplierKeys.all });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

### 4.8 Frontend Route Structure

```
_dashboard/
  suppliers/
    index.tsx                    # Supplier list page (DataTable, create button, search)
    $supplierId.tsx              # Supplier detail (header, contact info, address, metadata)
```

### 4.9 Frontend Component Structure

```
modules/suppliers/
  index.ts                       # Barrel export for hooks and components
  hooks/
    index.ts                     # Re-exports from use-suppliers.ts
    use-suppliers.ts             # Query key factory, query hooks, mutation hooks
  components/
    index.ts                     # Barrel export for all components
    supplier-form-sheet.tsx      # Sheet form: name, email, phone, address, isActive
    supplier-detail-header.tsx   # Header: back link, name, status badge, dates, edit/delete buttons
    supplier-states.tsx          # LoadingError skeletons (SupplierLoadingState, SupplierErrorState)
    delete-dialog.tsx            # Confirmation dialog for supplier deletion
```

### 4.10 Frontend Hook API

```typescript
// Queries
useSuppliers(params?: Partial<ListSuppliersQuery>): UseQueryResult<PaginatedResponse<Supplier>>
useSupplier(id: string): UseQueryResult<Supplier>

// Mutations
useCreateSupplier(): UseMutationResult<Supplier, Error, CreateSupplierInput>
useUpdateSupplier(): UseMutationResult<Supplier, Error, UpdateSupplierInput & { id: string }>
useDeleteSupplier(): UseMutationResult<{ message: string }, Error, string>
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `supplier:view` permission, When they `GET /suppliers`, Then they receive a paginated list of suppliers scoped to their organization with serialized Date fields
- **AC-002**: Given an authenticated user with `supplier:create` permission, When they `POST /suppliers` with valid body, Then the supplier is created (201) and an audit log entry is written
- **AC-003**: Given an authenticated user with `supplier:update` permission, When they `PATCH /suppliers/:id` with valid body, Then the supplier is updated (200) with the new values and an audit log entry is written
- **AC-004**: Given a supplier that does not exist, When any endpoint referencing `:id` is called, Then a `404` with `{ message: 'Supplier not found' }` is returned
- **AC-005**: Given an authenticated user with `supplier:delete` permission, When they `DELETE /suppliers/:id`, Then the supplier is permanently deleted (200) and an audit log entry is written
- **AC-006**: Given a `POST /suppliers` request with a missing name or empty string name, Then a `422` validation error is returned
- **AC-007**: Given a `POST /suppliers` request with an invalid email format, Then a `422` validation error is returned
- **AC-008**: Given the list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on name, email, phone, and address
- **AC-009**: Given the list endpoint, When `isActive` query parameter is set to `"true"` or `"false"`, Then results are filtered by the active status
- **AC-010**: Given the list endpoint, When `sortBy` is set to an invalid field name, Then a `422` validation error is returned
- **AC-011**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-012**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-013**: Given the frontend list page, When a user types in the search box, Then after a 300ms debounce the search query is synced to the URL and a server-side fetch is triggered
- **AC-014**: Given the frontend list page, When a user with `supplier:create` permission views the page, Then the "Tambah Pemasok" button is visible
- **AC-015**: Given the frontend detail page, When a user with `supplier:update` permission views the page, Then the edit button is visible; the delete button is always visible
- **AC-016**: Given the `PATCH /suppliers/:id` request with `email: null`, Then the supplier's email is cleared (set to `null` in the database)

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, using Elysia's `app.handle(new Request(...))` pattern with mocked services
- **Backend test file**: `suppliers.test.ts` in the module directory
- **Test Data Management**: Mocked service layer via `mock.module('./suppliers.service', ...)` for isolated route testing
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404, 422), permission checks, validation edge cases (missing name, invalid email, empty name, invalid UUID)
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

### 6.1 Backend Test Cases

| Test | Endpoint | Scenario | Expected Status |
|------|----------|----------|----------------|
| List suppliers | `GET /suppliers` | Valid request returns paginated data | 200 |
| List with isActive filter | `GET /suppliers?isActive=true` | Valid filter accepted | 200 |
| List with sort params | `GET /suppliers?sortBy=name&sortOrder=asc` | Valid sort accepted | 200 |
| List with invalid sortBy | `GET /suppliers?sortBy=invalidField` | Invalid sort field | 422 |
| Create supplier | `POST /suppliers` | Valid body with all fields | 201 |
| Create without name | `POST /suppliers` | Missing name | 422 |
| Create with invalid email | `POST /suppliers` | Invalid email format | 422 |
| Create with empty name | `POST /suppliers` | Empty string name | 422 |
| Get supplier | `GET /suppliers/:id` | Existing supplier | 200 |
| Get non-existent | `GET /suppliers/:id` | Unknown ID | 404 |
| Get invalid UUID | `GET /suppliers/not-a-uuid` | Non-UUID param | 422 |
| Update supplier | `PATCH /suppliers/:id` | Valid update | 200 |
| Update non-existent | `PATCH /suppliers/:id` | Unknown ID | 404 |
| Update invalid email | `PATCH /suppliers/:id` | Invalid email format | 422 |
| Update invalid UUID | `PATCH /suppliers/not-a-uuid` | Non-UUID param | 422 |
| Delete supplier | `DELETE /suppliers/:id` | Existing supplier | 200 |
| Delete non-existent | `DELETE /suppliers/:id` | Unknown ID | 404 |
| Delete invalid UUID | `DELETE /suppliers/not-a-uuid` | Non-UUID param | 422 |

## 7. Rationale & Context

### Why Hard Delete for Suppliers?

Unlike products (which have complex relationships with variants, images, and sales history), suppliers have a simpler data model. Hard delete was chosen as the initial implementation because supplier records can be recreated if needed, and the foreign key relationship with `PurchaseOrder` provides a natural safety net — suppliers with existing purchase orders cannot be accidentally deleted at the database level. If a soft-delete/archive pattern is needed in the future, it can be added as a migration.

### Why No Slug Field?

Suppliers are identified by UUID and do not need URL-friendly identifiers for public-facing routes. Unlike products, which may be exposed in catalogs or POS barcode lookups, suppliers are internal administrative entities. The `name` field combined with the UUID is sufficient for identification and search.

### Why Search Across Four Fields?

Supplier data is often entered inconsistently — a user might remember a vendor by company name, contact email, phone number, or address fragment. Searching across all four text fields (name, email, phone, address) with case-insensitive contains matching ensures users can find suppliers regardless of which detail they recall.

### Why Nullable Fields on Update DTO?

The `updateSupplierDto` uses `.nullable()` on `email`, `phone`, and `address` to allow two distinct operations: omitting the field (no change) versus explicitly sending `null` (clear the value). This is important because a supplier may have had contact information that needs to be removed without deleting the entire supplier record.

### Why isActive Filter as String Transform?

Query parameters in HTTP requests arrive as strings. The `isActive` filter uses `z.string().transform(v => v === 'true').pipe(z.boolean())` to convert the string `"true"` or `"false"` into a proper boolean, while keeping the parameter optional. This avoids requiring API consumers to send `isActive=1` or other non-standard boolean representations.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience. Labels like "Nama Pemasok", "Telepon", "Alamat" and messages like "Beruang sedang mencari pemasok..." reflect this convention.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all supplier data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **PurchaseOrder** - References suppliers via `supplierId` foreign key; deleting a supplier with existing purchase orders is blocked at the database level
- **DAT-002**: **AuditLog** - All write operations (create, update, delete) on suppliers produce audit log entries

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe params
- **PLT-005**: **TanStack Table** - Headless table utility for data grids (via `DataTable` component)
- **PLT-006**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Button, Input, etc.)
- **PLT-007**: **Lucide React** - Icon library (Truck, Mail, Phone, Pencil, Trash2, Eye, Plus, AlertCircle, ArrowLeft)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { suppliersService } from './suppliers.service'
import { errorResponse } from '#common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const supplierSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const createSupplierDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const updateSupplierDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const listSuppliersQuery = paginationQuery
  .extend(sortQuery(['name', 'createdAt', 'updatedAt']).shape)
  .extend({
    search: z.string().optional(),
    isActive: z.string().transform((v) => v === 'true').pipe(z.boolean()).optional(),
  })

const serializeSupplier = (s: {
  createdAt: Date
  updatedAt: Date
}) => ({
  ...s,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
})

export const suppliersRoute = new Elysia({
  prefix: '/suppliers',
  tags: ['Suppliers'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, search, isActive, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await suppliersService.listSuppliers(organization.id, {
      skip, take, search, isActive,
      orderBy: sortBy ? { field: sortBy, order: sortOrder ?? 'desc' } : undefined,
    })
    return {
      data: data.map(serializeSupplier),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { supplier: ['view'] },
    query: listSuppliersQuery,
    response: { 200: paginatedResponse(supplierSchema) },
    detail: { summary: 'List suppliers', description: '...' },
  })
  .post('/', async ({ _authType, organization, user, body, status }) => {
    const supplier = await suppliersService.createSupplier(organization.id, body)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Supplier',
      operation: 'create',
      args: { data: body },
    })
    return status(201, serializeSupplier(supplier))
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { supplier: ['create'] },
    body: createSupplierDto,
    response: { 201: supplierSchema },
    detail: { summary: 'Create a supplier', description: '...' },
  })
  .get('/:id', async ({ organization, params, status }) => {
    const supplier = await suppliersService.getSupplier(organization.id, params.id)
    if (!supplier) return status(404, { message: 'Supplier not found' })
    return serializeSupplier(supplier)
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { supplier: ['view'] },
    params: z.object({ id: z.string().uuid() }),
    response: { 200: supplierSchema, 404: errorResponse },
    detail: { summary: 'Get a supplier', description: '...' },
  })
  .patch('/:id', async ({ _authType, organization, user, params, body, status }) => {
    const supplier = await suppliersService.updateSupplier(organization.id, params.id, body)
    if (!supplier) return status(404, { message: 'Supplier not found' })
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Supplier',
      operation: 'update',
      args: { id: params.id, data: body },
    })
    return serializeSupplier(supplier)
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { supplier: ['update'] },
    params: z.object({ id: z.string().uuid() }),
    body: updateSupplierDto,
    response: { 200: supplierSchema, 404: errorResponse },
    detail: { summary: 'Update a supplier', description: '...' },
  })
  .delete('/:id', async ({ _authType, organization, user, params, status }) => {
    const deleted = await suppliersService.deleteSupplier(organization.id, params.id)
    if (!deleted) return status(404, { message: 'Supplier not found' })
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Supplier',
      operation: 'delete',
      args: { id: params.id },
    })
    return status(200, { message: 'Supplier deleted' })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { supplier: ['delete'] },
    params: z.object({ id: z.string().uuid() }),
    response: { 200: errorResponse, 404: errorResponse },
    detail: { summary: 'Delete a supplier', description: '...' },
  })
```

### 9.2 Backend Service

```typescript
import { prisma } from '#integrations/prisma'

export const suppliersService = {
  async listSuppliers(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      isActive?: boolean
      orderBy?: { field: 'name' | 'createdAt' | 'updatedAt'; order: 'asc' | 'desc' }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.isActive !== undefined && { isActive: params.isActive }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search, mode: 'insensitive' as const } },
          { address: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.supplier.count({ where }),
    ])
    return { data, total }
  },

  async getSupplier(organizationId: string, id: string) {
    return prisma.supplier.findFirst({ where: { id, organizationId } })
  },

  async createSupplier(
    organizationId: string,
    data: { name: string; email?: string; phone?: string; address?: string },
  ) {
    return prisma.supplier.create({ data: { ...data, organizationId } })
  },

  async updateSupplier(
    organizationId: string,
    id: string,
    data: { name?: string; email?: string | null; phone?: string | null; address?: string | null; isActive?: boolean },
  ) {
    const existing = await prisma.supplier.findFirst({ where: { id, organizationId } })
    if (!existing) return null
    return prisma.supplier.update({ where: { id }, data })
  },

  async deleteSupplier(organizationId: string, id: string) {
    const existing = await prisma.supplier.findFirst({ where: { id, organizationId } })
    if (!existing) return null
    return prisma.supplier.delete({ where: { id } })
  },
}
```

### 9.3 Frontend Hook

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#lib/api'
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'
import type { CreateSupplierInput, ListSuppliersQuery, UpdateSupplierInput, Supplier } from 'backend/src/modules/suppliers/suppliers.route'

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (params: ListSuppliersQuery) => [...supplierKeys.lists(), params] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
}

export function useSuppliers(params: Partial<ListSuppliersQuery> = {}) {
  return useQuery({
    queryKey: supplierKeys.list(params as ListSuppliersQuery),
    queryFn: async () => {
      const { data, error } = await api.suppliers.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
          isActive: params.isActive,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.suppliers({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSupplierInput) => {
      const { data, error } = await api.suppliers.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateSupplierInput & { id: string }) => {
      const { data, error } = await api.suppliers({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.suppliers({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
```

### 9.4 Edge Cases

- **Foreign key constraint on delete**: Deleting a supplier that is referenced by one or more `PurchaseOrder` records will fail at the database level with a foreign key constraint violation. The current implementation does not handle this gracefully (no 409 response). A future iteration should catch Prisma P2003 and return a user-friendly error message indicating that the supplier has associated purchase orders.
- **Clearing contact fields**: The `updateSupplierDto` allows `null` values for `email`, `phone`, and `address`, which explicitly clears these fields. The frontend handles this by sending `undefined` when the field is empty (which the backend treats as "no change") — only sending `null` would actually clear the field.
- **isActive filter string transform**: The `isActive` query parameter arrives as a string from the URL. The Zod schema transforms `"true"` to `true` and any other string value to `false`. Sending an arbitrary non-boolean string (e.g., `isActive=maybe`) will silently evaluate to `false`.
- **Cross-organization access**: The service layer scopes all queries by `organizationId`, preventing a user from accessing suppliers belonging to a different organization even if they know the UUID.
- **Default pagination**: When `take` is not provided to the service, it defaults to `50` rather than using the standard `10` used by some other modules. This should be noted for consistency.
- **Empty string email in create DTO**: The backend `createSupplierDto` marks `email` as `z.string().email().optional()`, meaning an empty string `""` would pass validation if `email` were provided without the optional flag. However, since the field is `optional()`, omitting it is the correct approach for no email.

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/suppliers/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`
3. **Serialization**: All Date fields return ISO 8601 strings
4. **Hard delete**: DELETE permanently removes the supplier row; no soft delete mechanism
5. **Pagination**: List endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `isActive`; returns `{ data, meta }`
6. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`
9. **Cache invalidation**: Mutations invalidate the correct query key scopes including `auditLogKeys.all`
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **Permission guards**: Create/edit UI elements gated by `useHasPermission('supplier:create')` and `useHasPermission('supplier:update')`
12. **Debounced search**: 300ms debounce on search input with URL sync via `replace: true`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- SortableHeader component: `packages/frontend/src/components/ui/sortable-header.tsx`
- Products module specification: `specs/products/spec-v1.md` (reference for patterns)
- Purchase orders module: `packages/backend/src/modules/purchase-orders/` (consumer of supplier data)
- Dashboard route permissions: `packages/frontend/src/routes/_dashboard/route.tsx` (maps `/suppliers` to `supplier` permission)
- Audit logs hooks: `packages/frontend/src/modules/audit-logs/hooks/use-audit-logs.ts` (cross-module cache invalidation)
