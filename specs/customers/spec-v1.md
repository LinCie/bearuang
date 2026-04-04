---
title: Customers Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: customers
tags: [customers, crud, elysia, prisma, react, tanstack, offline-sync]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the customers domain in BearUang. It covers the **Customer** resource — the entity representing people and businesses that purchase goods through the system. Customers support offline creation via the POS sync batch endpoint and are referenced by sales orders.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, Prisma model, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components, routes, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Conventions**: file naming, code organization, permission model, soft-delete via `isActive`, audit logging, offline sync
- **Offline sync**: Customer creation through the POS sync batch endpoint (`POST /sync/batch`)

**Audience**: Developers building new modules or modifying the customers domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Resource** | A domain entity exposed via CRUD API endpoints (e.g., Customer) |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings before API response |
| **Soft Delete** | Setting `isActive` to `false` instead of removing the row; list queries filter by `isActive: true` by default |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for create/edit forms |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |
| **Sync Batch** | A `POST /sync/batch` endpoint that processes offline mutations created in POS, including customer creation |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The module resides in `packages/backend/src/modules/customers/` with a `.route.ts`, `.service.ts`, and `.test.ts` file
- **REQ-002**: Route plugin is an Elysia instance with `{ prefix: '/customers', tags: ['Customers'] }`
- **REQ-003**: Route plugin uses `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint declares `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { customer: ['action'] }` where actions are `view`, `create`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: `serializeCustomer` converts Prisma Date types to ISO strings before returning to client
- **REQ-009**: All Prisma queries are scoped by `organizationId` and `isActive` (true for active, false for trashed)
- **REQ-010**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` are defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-013**: Invalid input returns `422` via Zod validation errors

### 3.2 Service Layer

- **REQ-014**: Service is exported as an object literal: `export const customersService = { async method() {...} }`
- **REQ-015**: List endpoints use `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-016**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-017**: Search uses case-insensitive `contains` on `name` and `email` fields
- **REQ-018**: List defaults to `isActive: true`; trashed list uses `isActive: false`
- **REQ-019**: Soft delete sets `isActive` to `false`; restore sets it to `true`
- **REQ-020**: Service methods (`getCustomer`, `updateCustomer`, `deleteCustomer`, `restoreCustomer`) check existence via `findFirst` and return `null` if not found (rather than throwing)
- **REQ-021**: Default sort is `{ createdAt: 'desc' }`; default page size is `50` in the service layer

### 3.3 Frontend Architecture

- **REQ-022**: Module resides in `packages/frontend/src/modules/customers/` with `hooks/`, `components/`, and `index.ts`
- **REQ-023**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-customers.ts`
- **REQ-024**: Query key factory is defined in `hooks/use-customers.ts` as a hierarchical object `customerKeys`
- **REQ-025**: Cache invalidation targets the correct query key scope after mutations, including `auditLogKeys.all`
- **REQ-026**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-027**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-md`)
- **REQ-028**: Delete confirmations use shadcn `Dialog`
- **REQ-029**: List page uses `DataTable` (TanStack Table wrapper) with manual sorting, server-side pagination, debounced search
- **REQ-030**: Permission-gated UI via `useHasPermission('customer:action')`
- **REQ-031**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-032**: Dates formatted with `id-ID` locale

### 3.4 Database

- **REQ-033**: Model uses UUID v7 primary key (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-034**: Model has `organizationId` field with an index for multi-tenant scoping
- **REQ-035**: Model uses `@@map("customer")` for database table naming
- **REQ-036**: Soft delete is implemented via `isActive Boolean @default(true)` rather than a `deletedAt` timestamp
- **REQ-037**: Customer has a one-to-many relation to `SalesOrder` (`salesOrders SalesOrder[]`)

### 3.5 Offline Sync

- **REQ-038**: Customers are included in the `SYNC_MODELS` list for initial sync (`GET /sync/initial`)
- **REQ-039**: Customers are included in the `SYNC_MODELS` list for delta sync (`GET /sync/delta`)
- **REQ-040**: Customer creation is supported via the batch sync endpoint (`POST /sync/batch`) with model `customers` and operation `create`
- **REQ-041**: Offline customer creation logs an audit entry with `offlineSync: true` and `tempId` in args

### 3.6 Constraints

- **CON-001**: Customer soft delete uses `isActive` flag (not `deletedAt` timestamp) — this differs from products which use `deletedAt`
- **CON-002**: Customer list defaults to `isActive: true`; to see inactive customers, use the `/trashed` endpoint
- **CON-003**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-004**: Customer has no unique constraints beyond the UUID primary key — duplicate names/emails are allowed within an organization
- **CON-005**: The `isActive` query parameter is a string transformed to boolean (`z.string().transform(v => v === 'true').pipe(z.boolean())`)
- **CON-006**: Offline sync only supports `create` operation for customers (no offline update/delete)

### 3.7 Guidelines

- **GUD-001**: Prefer `findFirst` with `organizationId` scoping over `findUnique` for tenant-safe lookups
- **GUD-002**: Use `paginatedResponse(customerSchema)` from `#common/pagination` for list response shapes
- **GUD-003**: Use `errorResponse` from `#common/error.response` for error response shapes
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: The `isActive` filter on the list endpoint allows clients to explicitly request all customers by omitting the parameter (defaults to `true`)

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Customers

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/customers` | List customers (paginated, searchable, filterable by active status) | `customer:view` | `{ data: Customer[], meta: PaginationMeta }` |
| POST | `/customers` | Create a customer | `customer:create` | `201 Customer` |
| GET | `/customers/trashed` | List inactive (soft-deleted) customers | `customer:view` | `{ data: Customer[], meta: PaginationMeta }` |
| POST | `/customers/:id/restore` | Restore inactive customer to active | `customer:delete` | `{ message }` or `404` |
| GET | `/customers/:id` | Get customer detail | `customer:view` | `Customer` or `404` |
| PATCH | `/customers/:id` | Update a customer | `customer:update` | `Customer` or `404` |
| DELETE | `/customers/:id` | Soft-delete customer (sets isActive to false) | `customer:delete` | `{ message }` or `404` |

#### Offline Sync (relevant to customers)

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| POST | `/sync/batch` | Process batch offline mutations (supports `customers` model with `create` operation) | Auth + Org | `{ results: BatchMutationResult[] }` |

### 4.2 Query Parameters (List Endpoints)

```typescript
interface ListCustomersQuery {
  page: number;       // default: 1
  pageSize: number;   // default: 10 (frontend), 50 (service fallback)
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
  search?: string;    // case-insensitive search on name and email
  isActive?: boolean; // string "true"/"false" transformed to boolean; default: true
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

#### Customer

```typescript
const customerSchema = z.object({
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

const createCustomerDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const updateCustomerDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
```

#### List Query

```typescript
const listCustomersQuery = paginationQuery
  .extend(sortQuery(['name', 'createdAt', 'updatedAt']).shape)
  .extend({
    search: z.string().optional(),
    isActive: z
      .string()
      .transform((v) => v === 'true')
      .pipe(z.boolean())
      .optional(),
  });
```

#### Frontend Form Validation

```typescript
const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama pelanggan wajib diisi')
    .max(100, 'Nama pelanggan maksimal 100 karakter'),
  email: z.union([z.string().email('Format email tidak valid'), z.literal('')]),
  phone: z.string().max(20, 'Nomor telepon maksimal 20 karakter'),
  address: z.string().max(500, 'Alamat maksimal 500 karakter'),
  isActive: z.boolean(),
});
```

### 4.5 Prisma Model

```prisma
model Customer {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  name           String
  email          String?
  phone          String?
  address        String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  salesOrders SalesOrder[]

  @@index([organizationId])
  @@map("customer")
}
```

### 4.6 Frontend Query Key Factory

```typescript
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: ListCustomersQuery) => [...customerKeys.lists(), params] as const,
  trashed: () => [...customerKeys.all, 'trashed'] as const,
  trashedList: (params: ListCustomersQuery) => [...customerKeys.trashed(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};
```

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After creating a customer:
queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a customer:
queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a customer:
queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
queryClient.invalidateQueries({ queryKey: customerKeys.trashed() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After restoring a customer:
queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
queryClient.invalidateQueries({ queryKey: customerKeys.trashed() });
queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

### 4.8 Frontend Route Structure

```
_dashboard/
  customers/
    index.tsx                    # Customer list page (DataTable, create button, trashed link)
    $customerId.tsx              # Customer detail (header, contact info, address, metadata)
    trashed/
      index.tsx                  # Trashed customers list with restore (batch + individual)
```

### 4.9 Frontend Component Structure

```
modules/customers/
  index.ts                       # Barrel export
  hooks/
    index.ts                     # Barrel export
    use-customers.ts             # Query keys, all query + mutation hooks
  components/
    index.ts                     # Barrel export
    customer-form-sheet.tsx      # Sheet form: name, email, phone, address, isActive
    customer-detail-header.tsx   # Header: back, name, status badge, edit/delete buttons
    customer-states.tsx          # LoadingError skeletons (CustomerLoadingState, CustomerErrorState)
    delete-dialog.tsx            # Confirmation dialog for customer deletion
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `customer:view` permission, When they `GET /customers`, Then they receive a paginated list of active customers scoped to their organization with serialized Date fields
- **AC-002**: Given an authenticated user with `customer:create` permission, When they `POST /customers` with valid body, Then the customer is created (201) and an audit log entry is written
- **AC-003**: Given a customer, When the customer is deleted (`DELETE /customers/:id`), Then `isActive` is set to `false` and the customer no longer appears in the default list
- **AC-004**: Given an inactive customer, When `POST /customers/:id/restore` is called, Then `isActive` is set to `true` and the customer reappears in normal listings
- **AC-005**: Given a list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on `name` and `email`
- **AC-006**: Given a list endpoint, When `isActive=false` is passed, Then only inactive customers are returned; when omitted, only active customers are returned
- **AC-007**: Given an invalid email in the request body, When creating or updating a customer, Then a `422` validation error is returned
- **AC-008**: Given an empty name in the request body, When creating a customer, Then a `422` validation error is returned
- **AC-009**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-010**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-011**: Given the frontend list page, When a user types in the search box, Then after a 300ms debounce the search query is synced to the URL and a server-side fetch is triggered
- **AC-012**: Given an offline POS session, When a customer is created offline, Then the customer is synced via `POST /sync/batch` with model `customers` and operation `create`, and an audit log entry is written with `offlineSync: true`
- **AC-013**: Given a non-existent customer ID, When any single-resource endpoint is called, Then a `404` with `{ message: 'Customer not found' }` is returned

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `customers.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Mock service module via `mock.module()` for isolated route testing
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404, 422), permission checks, validation (missing name, invalid email, invalid UUID), sort/search parameters, isActive filter
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

### Backend Test Coverage

| Test Suite | Cases |
|-----------|-------|
| `GET /customers` | Returns paginated list; accepts `isActive` filter; accepts `search` parameter; accepts sort params; returns 422 for invalid `sortBy` |
| `POST /customers` | Creates and returns 201; returns 422 when name is missing; returns 422 when email is invalid; returns 422 when name is empty string |
| `GET /customers/:id` | Returns customer when exists; returns 404 when not found; returns 422 for invalid UUID |
| `PATCH /customers/:id` | Updates and returns 200; returns 404 when not found; returns 422 for invalid email; returns 422 for invalid UUID |
| `DELETE /customers/:id` | Deletes and returns 200; returns 404 when not found; returns 422 for invalid UUID |

## 7. Rationale & Context

### Why `isActive` Instead of `deletedAt`?

The customer module uses an `isActive` boolean flag rather than a `deletedAt` timestamp for soft-delete. This simplifies the default query — `isActive: true` is the natural filter for active customers, while `isActive: false` groups all inactive customers (whether manually deactivated or "deleted"). This approach avoids the need for separate null/not-null date checks and makes the semantics clearer for business users who think in terms of active vs inactive.

### Why No Unique Constraints on Customer Fields?

Unlike products (which require unique slugs and SKUs), customers allow duplicate names and emails within an organization. This reflects real-world scenarios where multiple customers may share names or belong to the same household. The service layer does not enforce uniqueness, and the route layer does not handle `P2002` conflicts.

### Why Offline Customer Creation?

The POS module operates in environments with intermittent connectivity. Sales representatives may need to create a new customer on-the-spot during a transaction. The sync batch endpoint (`POST /sync/batch`) processes these offline-created customers when connectivity is restored, assigning server-side UUIDs and logging audit entries.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all customer data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **SalesOrder** - References customers via `customerId`; a customer may have many sales orders
- **DAT-002**: **Sales Orders module** (`/sales-orders`) - The `createSalesOrder` endpoint accepts an optional `customerId` to associate the order with a customer
- **DAT-003**: **POS module** (`/sync/batch`) - The sync batch endpoint creates customers offline, which are then referenced by offline sales orders
- **DAT-004**: **Dashboard module** (`/dashboard`) - Displays active customer count and recent sales order customer names

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation, optimistic updates)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe params
- **PLT-005**: **TanStack Table** - Headless table utility for data grids
- **PLT-006**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Button, Input, Checkbox, Textarea)
- **PLT-007**: **TanStack Form** - Form state management with Zod validation
- **PLT-008**: **Sonner** - Toast notifications for restore success/error feedback

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete, restore) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { customersService } from './customers.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const customerSchema = z.object({
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

export const createCustomerDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const updateCustomerDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const listCustomersQuery = paginationQuery
  .extend(sortQuery(['name', 'createdAt', 'updatedAt']).shape)
  .extend({
    search: z.string().optional(),
    isActive: z
      .string()
      .transform((v) => v === 'true')
      .pipe(z.boolean())
      .optional(),
  })

const serializeCustomer = (c: {
  createdAt: Date
  updatedAt: Date
}) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
})

export const customersRoute = new Elysia({
  prefix: '/customers',
  tags: ['Customers'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, search, isActive, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await customersService.listCustomers(
      organization.id,
      {
        skip, take, search, isActive,
        orderBy: sortBy
          ? { field: sortBy, order: sortOrder ?? 'desc' }
          : undefined,
      },
    )
    return {
      data: data.map(serializeCustomer),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { customer: ['view'] },
    query: listCustomersQuery,
    response: { 200: paginatedResponse(customerSchema) },
    detail: {
      summary: 'List customers',
      description: 'Retrieves a paginated list of customers for the authenticated organization.',
    },
  })
  .post('/', async ({ _authType, organization, user, body, status }) => {
    const customer = await customersService.createCustomer(organization.id, body)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Customer',
      operation: 'create',
      args: { data: body },
    })
    return status(201, serializeCustomer(customer))
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { customer: ['create'] },
    body: createCustomerDto,
    response: { 201: customerSchema },
    detail: {
      summary: 'Create a customer',
      description: 'Creates a new customer for the authenticated organization.',
    },
  })
  .delete('/:id', async ({ _authType, organization, user, params, status }) => {
    const deleted = await customersService.deleteCustomer(organization.id, params.id)
    if (!deleted) return status(404, { message: 'Customer not found' })
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Customer',
      operation: 'delete',
      args: { id: params.id },
    })
    return status(200, { message: 'Customer deleted' })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { customer: ['delete'] },
    params: z.object({ id: z.string().uuid() }),
    response: { 200: errorResponse, 404: errorResponse },
    detail: {
      summary: 'Delete a customer',
      description: 'Soft-deletes a customer by setting isActive to false.',
    },
  })
```

### 9.2 Backend Service

```typescript
import { prisma } from '#integrations/prisma'

export const customersService = {
  async listCustomers(
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
      isActive: params?.isActive ?? true,
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ])
    return { data, total }
  },

  async getCustomer(organizationId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId },
    })
  },

  async createCustomer(
    organizationId: string,
    data: { name: string; email?: string; phone?: string; address?: string },
  ) {
    return prisma.customer.create({
      data: { ...data, organizationId },
    })
  },

  async updateCustomer(
    organizationId: string,
    id: string,
    data: { name?: string; email?: string | null; phone?: string | null; address?: string | null; isActive?: boolean },
  ) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data,
    })
  },

  async deleteCustomer(organizationId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data: { isActive: false },
    })
  },

  async restoreCustomer(organizationId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId, isActive: false },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data: { isActive: true },
    })
  },
}
```

### 9.3 Frontend Hook

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#lib/api'
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from 'backend/src/modules/customers/customers.route'

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: ListCustomersQuery) => [...customerKeys.lists(), params] as const,
  trashed: () => [...customerKeys.all, 'trashed'] as const,
  trashedList: (params: ListCustomersQuery) => [...customerKeys.trashed(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

export function useCustomers(params: Partial<ListCustomersQuery> = {}) {
  return useQuery({
    queryKey: customerKeys.list(params as ListCustomersQuery),
    queryFn: async () => {
      const { data, error } = await api.customers.get({ query: params })
      if (error) throw error
      return data
    },
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data, error } = await api.customers.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.customers({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerKeys.trashed() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.customers({ id }).restore.post()
      if (error) throw error
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerKeys.trashed() })
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
```

### 9.4 Edge Cases

- **No uniqueness enforcement**: Multiple customers can share the same name or email within an organization; the system does not enforce uniqueness or return 409 conflicts
- **Nullable field clearing**: The `updateCustomerDto` allows setting `email`, `phone`, and `address` to `null` via `.nullable().optional()`, enabling users to clear previously set values
- **isActive filter string-to-boolean transform**: The `isActive` query parameter arrives as a string from the URL; it is transformed via `z.string().transform(v => v === 'true').pipe(z.boolean())` — passing any value other than `"true"` results in `false`
- **Offline customer creation limitations**: Only `create` is supported in the sync batch for customers; offline updates or deletes to customers are not supported
- **Trashed page batch restore**: The trashed customers page supports batch restore with row selection, animated exit transitions, and per-mutation error handling with toast notifications
- **Customer detail "Tambahkan" CTAs**: When email, phone, or address are missing on the detail page, contextual "Tambahkan" links appear (permission-gated) to guide users to edit the customer
- **Email validation on frontend vs backend**: Frontend allows empty string via `z.union([z.string().email(), z.literal('')])`, but backend uses `z.string().email().optional()` — empty strings are coerced to `undefined` before sending to the API
- **Search scope**: Search only covers `name` and `email` fields; phone and address are not included in search despite being text fields

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/customers/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`
3. **Serialization**: All Date fields return ISO 8601 strings
4. **Soft delete**: DELETE sets `isActive: false`; separate trashed list endpoint; restore endpoint sets `isActive: true`
5. **Pagination**: List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `isActive`; return `{ data, meta }`
6. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `trashed()`, `trashedList(params)`, `detail(id)`
9. **Cache invalidation**: Mutations invalidate the correct query key scopes including `auditLogKeys.all`
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **Permission guards**: Create/edit/delete UI elements gated by `useHasPermission`
12. **Offline sync**: Customer creation is supported via `POST /sync/batch` with audit logging
13. **Null-safe field clearing**: Update DTO supports nullable fields to clear previously set values

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Sync module: `packages/backend/src/modules/sync/sync.route.ts`
- Sales orders module: `packages/backend/src/modules/sales-orders/sales-orders.route.ts`
- Dashboard module: `packages/backend/src/modules/dashboard/dashboard.route.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- SortableHeader component: `packages/frontend/src/components/ui/sortable-header.tsx`
- Audit log query keys: `packages/frontend/src/modules/audit-logs/hooks/use-audit-logs.ts`
- Permission hook: `packages/frontend/src/lib/use-permissions.ts`
- Debounce hook: `packages/frontend/src/hooks/use-debounce.ts`
