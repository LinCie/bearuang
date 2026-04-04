---
title: Purchase Orders Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: purchase-orders
tags: [purchase-orders, state-machine, stock-movements, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the purchase orders domain in BearUang. It covers the **PurchaseOrder** entity with its line items (**PurchaseOrderItem**), a finite-state machine governing order lifecycle, payment tracking, and automatic stock-in movements on receipt. This spec follows the same patterns established by the products module specification.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugins, service layer with state machine, Prisma models, and serialization patterns
- **State machine**: Valid status transitions, terminal states, and business rules governing lifecycle progression
- **Frontend module structure**: TanStack Query hooks, React components (form sheet, badges, delete dialog), and UI patterns
- **API contracts**: HTTP endpoints (CRUD + status transitions + receive), request/response schemas, error handling
- **Stock integration**: Automatic stock movement creation and variant stock increment on purchase order receipt
- **Payment tracking**: Amount-paid accumulation with automatic payment-status derivation
- **Conventions**: file naming, code organization, permission model, permanent delete, audit logging

**Audience**: Developers building or modifying the purchase orders domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Purchase Order** | A procurement document sent to a supplier, containing one or more line items (variants with quantities and unit costs) destined for a specific warehouse |
| **Purchase Order Item** | A single line item on a purchase order, linking a product variant with a quantity, unit cost, and received quantity |
| **Status Machine** | A finite-state machine governing the lifecycle of a purchase order: `PENDING -> CONFIRMED -> SHIPPED -> RECEIVED -> COMPLETED/CANCELLED` |
| **Terminal Status** | A status from which no further transitions are possible: `COMPLETED` or `CANCELLED` |
| **Receive** | The act of recording that items on a shipped purchase order have arrived at the warehouse; triggers stock-in movements |
| **Stock Movement** | An inventory record (`StockMovement`) created automatically when items are received, incrementing variant stock |
| **Amount Paid Accumulation** | The `amountPaid` field grows incrementally with each payment; `paymentStatus` is derived automatically (`UNPAID` / `PARTIALLY_PAID` / `PAID`) |
| **Permanent Delete** | Purchase orders are hard-deleted (not soft-deleted); only `PENDING` orders may be deleted |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for the create form |
| **Combobox** | A searchable dropdown component for selecting related entities (supplier, warehouse, variant) |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: Module resides in `packages/backend/src/modules/purchase-orders/` with `.route.ts`, `.service.ts`, and `.test.ts` files
- **REQ-002**: Route plugin is an Elysia instance with `{ prefix: '/purchase-orders', tags: ['Purchase Orders'] }`
- **REQ-003**: Route plugin uses `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint declares `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { purchaseOrder: ['action'] }` where actions are `view`, `create`, `update`, `receive`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: Decimal fields (`amountPaid`, `unitCost`) use `z.string()` in response schemas because they are serialized to string via `.toString()`
- **REQ-009**: `serializePurchaseOrder` converts Prisma types (Date -> ISO string, Decimal -> string) before returning to client
- **REQ-010**: All Prisma queries are scoped by `organizationId`
- **REQ-011**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: `RECEIVED` status cannot be set via `PATCH /:id` -- it must be set via `POST /:id/receive`
- **REQ-014**: `COMPLETED` status requires all items to have `receivedQty >= quantity`
- **REQ-015**: Not-found scenarios return `404` with `{ message: string }`; business rule violations return `400` with `{ message: string }`

### 3.2 State Machine

- **REQ-016**: Valid status transitions are defined in the `STATUS_TRANSITIONS` map in the service layer
- **REQ-017**: `PENDING` may transition to `CONFIRMED` or `CANCELLED`
- **REQ-018**: `CONFIRMED` may transition to `SHIPPED` or `CANCELLED`
- **REQ-019**: `SHIPPED` may transition to `CANCELLED`
- **REQ-020**: `RECEIVED` may transition to `COMPLETED` or `CANCELLED`
- **REQ-021**: `COMPLETED` and `CANCELLED` are terminal statuses with no outgoing transitions
- **REQ-022**: `RECEIVED` status is set automatically by the `receivePurchaseOrder` service method, not via PATCH
- **REQ-023**: Transition to `RECEIVED` is only allowed from `CONFIRMED` or `SHIPPED`
- **REQ-024**: Orders in terminal status (`COMPLETED`, `CANCELLED`) cannot be modified via PATCH

### 3.3 Service Layer

- **REQ-025**: Service is exported as an object literal: `export const purchaseOrdersService = { async method() {...} }`
- **REQ-026**: List endpoint uses `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-027**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-028**: No search parameter -- list endpoint filters by `status`, `paymentStatus`, `supplierId`, `warehouseId`, and sorts by `createdAt`, `updatedAt`, `orderedAt`
- **REQ-029**: Delete is permanent (`prisma.purchaseOrder.delete`), not soft-delete; only allowed when status is `PENDING`
- **REQ-030**: The `receivePurchaseOrder` method runs in a `prisma.$transaction` that (a) updates item `receivedQty`, (b) creates `StockMovement` records with `type: 'IN'`, (c) increments `ProductVariant.stock`, and (d) sets order status to `RECEIVED` with `receivedAt`
- **REQ-031**: When `amountPaid` is updated, the service computes `cappedPaid = Math.min(currentPaid + newAmount, orderTotal)` and auto-derives `paymentStatus`

### 3.4 Frontend Architecture

- **REQ-032**: Module resides in `packages/frontend/src/modules/purchase-orders/` with `hooks/`, `components/`, and `index.ts`
- **REQ-033**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-purchase-orders.ts`
- **REQ-034**: Query key factory is defined inline in `hooks/use-purchase-orders.ts` as `purchaseOrderKeys`
- **REQ-035**: Cache invalidation must target the correct query key scope after mutations, including cross-module keys (`variantKeys`, `auditLogKeys`)
- **REQ-036**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-037**: Create form uses shadcn `Sheet` component (slide-over, `sm:max-w-lg`)
- **REQ-038**: Delete confirmations use shadcn `Dialog`
- **REQ-039**: Permission-gated UI via `useHasPermission('purchaseOrder:action')`
- **REQ-040**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-041**: Currency formatted as IDR via `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`

### 3.5 Database

- **REQ-042**: All models use UUID v7 primary keys (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-043**: All models have `organizationId` field with an index for multi-tenant scoping
- **REQ-044**: Purchase orders do not support soft delete -- they are permanently deleted from the database
- **REQ-045**: Models use `@@map("snake_case_table_name")` for database table naming
- **REQ-046**: `PurchaseOrderItem` uses `onDelete: Cascade` for owned children
- **REQ-047**: `PurchaseOrderStatus` is a Prisma enum with values: `PENDING`, `CONFIRMED`, `SHIPPED`, `RECEIVED`, `COMPLETED`, `CANCELLED`
- **REQ-048**: `PurchaseOrderPaymentStatus` is a Prisma enum with values: `UNPAID`, `PARTIALLY_PAID`, `PAID`

### 3.6 Constraints

- **CON-001**: Hyphenated resource name `purchase-orders` requires bracket notation in Eden client: `api['purchase-orders']`
- **CON-002**: Prisma Decimal fields (`amountPaid`, `unitCost`) are serialized to strings via `.toString()` -- use `z.string()` in response schemas
- **CON-003**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-004**: `RECEIVED` status is not in the `updatePurchaseOrderDto` status enum -- setting it via PATCH returns 422
- **CON-005**: The `receivePurchaseOrder` endpoint uses a dedicated `receiveItemDto` with `itemId` + `receivedQty`, separate from the general update DTO
- **CON-006**: Items are created inline with the purchase order via Prisma nested `create` -- there is no separate item management API (no add/update/remove item endpoints)
- **CON-007**: Payment amount accumulation is additive (`currentPaid + newAmount`) and capped at order total

### 3.7 Guidelines

- **GUD-001**: Prefer `findUniqueOrThrow` or `findFirst` with null check when the record must exist
- **GUD-002**: Use `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-003**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: Co-locate query keys with the hooks file when there is no separate `query-keys.ts`
- **GUD-006**: Invalidate cross-module caches (variants, audit logs) after receive operations that affect variant stock

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Purchase Orders

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/purchase-orders` | List purchase orders (paginated, filterable by status, paymentStatus, supplierId, warehouseId) | `purchaseOrder:view` | `{ data: PurchaseOrder[], meta: PaginationMeta }` |
| POST | `/purchase-orders` | Create purchase order with line items | `purchaseOrder:create` | `201 PurchaseOrder` |
| GET | `/purchase-orders/:id` | Get purchase order detail (with supplier, warehouse, items) | `purchaseOrder:view` | `PurchaseOrder` |
| PATCH | `/purchase-orders/:id` | Update purchase order (status transitions, payment tracking, fields) | `purchaseOrder:update` | `PurchaseOrder` / `400` / `404` |
| POST | `/purchase-orders/:id/receive` | Receive items on purchase order (creates stock movements) | `purchaseOrder:receive` | `PurchaseOrder` / `400` / `404` |
| DELETE | `/purchase-orders/:id` | Permanently delete purchase order (only PENDING) | `purchaseOrder:delete` | `{ message }` / `400` / `404` |

### 4.2 State Machine Diagram

```
  PENDING ────────── CONFIRMED ────────── SHIPPED
    │  \                │    \               │
    │   └─ CANCELLED    │     └─ CANCELLED   └─ CANCELLED
    │                   │                      │
    └── CONFIRMED       └── SHIPPED ──────────┘
                         │
                    (via /receive endpoint)
                         │
                       RECEIVED
                       ╱      ╲
                  COMPLETED   CANCELLED
                  (terminal)  (terminal)
```

#### Valid Transitions Table

| From | To | Method | Notes |
|------|----|--------|-------|
| PENDING | CONFIRMED | PATCH `/:id` | Standard procurement flow |
| PENDING | CANCELLED | PATCH `/:id` | Cancel before confirmation |
| CONFIRMED | SHIPPED | PATCH `/:id` | Supplier has shipped |
| CONFIRMED | CANCELLED | PATCH `/:id` | Cancel after confirmation |
| CONFIRMED | RECEIVED | POST `/:id/receive` | Receive directly (skip shipped) |
| SHIPPED | RECEIVED | POST `/:id/receive` | Items arrive at warehouse |
| SHIPPED | CANCELLED | PATCH `/:id` | Cancel after shipping |
| RECEIVED | COMPLETED | PATCH `/:id` | Requires all items fully received |
| RECEIVED | CANCELLED | PATCH `/:id` | Cancel after receiving |

#### Terminal Statuses

| Status | Description |
|--------|-------------|
| COMPLETED | Order fully received and closed; no further modifications allowed |
| CANCELLED | Order cancelled; no further modifications allowed |

### 4.3 Query Parameters (List Endpoint)

```typescript
interface ListPurchaseOrdersQuery extends PaginationQuery {
  status?: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  supplierId?: string;
  warehouseId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'orderedAt';
  sortOrder?: 'asc' | 'desc';
}
```

Note: Unlike the products module, there is no `search` parameter on the purchase orders list endpoint.

### 4.4 Response Shapes

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

### 4.5 Zod Schema Definitions

#### Purchase Order

```typescript
const purchaseOrderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  supplierId: z.string(),
  supplier: z.object({ id: z.string(), name: z.string() }),
  warehouseId: z.string(),
  warehouse: z.object({ id: z.string(), name: z.string() }),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'COMPLETED', 'CANCELLED']),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']),
  paymentMethod: z.string().nullable(),
  amountPaid: z.string(),           // Decimal serialized to string
  orderedAt: z.iso.datetime().nullable(),
  receivedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(purchaseOrderItemSchema),
});
```

#### Purchase Order Item

```typescript
const purchaseOrderItemSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  variantId: z.string(),
  variant: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
  }),
  quantity: z.number().int(),
  unitCost: z.string(),             // Decimal serialized to string
  receivedQty: z.number().int(),
});
```

#### Create Purchase Order

```typescript
const createPurchaseOrderItemDto = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

const createPurchaseOrderDto = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  orderedAt: z.iso.datetime().optional(),
  note: z.string().optional(),
  items: z.array(createPurchaseOrderItemDto).min(1),
});
```

#### Update Purchase Order

```typescript
const updatePurchaseOrderDto = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER', 'CARD']).nullable().optional(),
  amountPaid: z.number().nonnegative().optional(),
  supplierId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  orderedAt: z.iso.datetime().nullable().optional(),
  note: z.string().nullable().optional(),
});
```

Note: `RECEIVED` is intentionally excluded from the update DTO status enum. It must be set via the receive endpoint.

#### Receive Purchase Order

```typescript
const receiveItemDto = z.object({
  itemId: z.string().uuid(),
  receivedQty: z.number().int().positive(),
});

const receivePurchaseOrderDto = z.object({
  items: z.array(receiveItemDto).min(1),
});
```

### 4.6 Prisma Models

```prisma
enum PurchaseOrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  RECEIVED
  COMPLETED
  CANCELLED

  @@map("purchase_order_status")
}

enum PurchaseOrderPaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID

  @@map("purchase_order_payment_status")
}

model PurchaseOrder {
  id             String                     @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  supplierId     String                     @db.Uuid
  supplier       Supplier                   @relation(fields: [supplierId], references: [id])
  warehouseId    String                     @db.Uuid
  warehouse      Warehouse                  @relation(fields: [warehouseId], references: [id])
  status         PurchaseOrderStatus        @default(PENDING)
  paymentStatus  PurchaseOrderPaymentStatus @default(UNPAID)
  paymentMethod  String?
  amountPaid     Decimal                    @default(0) @db.Decimal(12, 2)
  orderedAt      DateTime?
  receivedAt     DateTime?
  note           String?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  items PurchaseOrderItem[]

  @@index([organizationId])
  @@index([supplierId])
  @@index([warehouseId])
  @@map("purchase_order")
}

model PurchaseOrderItem {
  id              String         @id @default(dbgenerated("uuidv7()")) @db.Uuid
  purchaseOrderId String         @db.Uuid
  purchaseOrder   PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  variantId       String         @db.Uuid
  variant         ProductVariant @relation(fields: [variantId], references: [id])
  quantity        Int
  unitCost        Decimal        @db.Decimal(12, 2)
  receivedQty     Int            @default(0)

  @@index([purchaseOrderId])
  @@index([variantId])
  @@map("purchase_order_item")
}
```

### 4.7 Frontend Query Key Factory

```typescript
export const purchaseOrderKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (params: ListPurchaseOrdersQuery) =>
    [...purchaseOrderKeys.lists(), params] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
  bySupplier: (supplierId: string) =>
    [...purchaseOrderKeys.all, 'bySupplier', supplierId] as const,
  byWarehouse: (warehouseId: string) =>
    [...purchaseOrderKeys.all, 'byWarehouse', warehouseId] as const,
};
```

### 4.8 Frontend Cache Invalidation Patterns

```typescript
// After creating a purchase order:
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.bySupplier(variables.supplierId) });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.byWarehouse(variables.warehouseId) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a purchase order:
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.bySupplier(variables.supplierId) });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.byWarehouse(variables.warehouseId) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After receiving a purchase order (cross-module invalidation):
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(data.id) });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.bySupplier(data.supplierId) });
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.byWarehouse(data.warehouseId) });
// Invalidate variant stock since receiving creates stock movements
for (const item of data.items) {
  queryClient.invalidateQueries({ queryKey: variantKeys.detail(item.variantId) });
}
queryClient.invalidateQueries({ queryKey: variantKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a purchase order:
queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

### 4.9 Frontend Component Structure

```
modules/purchase-orders/
  index.ts                                   # Barrel export: hooks + components
  hooks/
    index.ts                                 # Barrel export
    use-purchase-orders.ts                   # Query keys + all query + mutation hooks
  components/
    purchase-order-form-sheet.tsx            # Sheet form: supplier, warehouse, dynamic item rows (variant, qty, cost)
    purchase-order-badges.tsx                # StatusBadge, PaymentStatusBadge, LargeStatusBadge, formatRupiah
    delete-dialog.tsx                        # Reusable delete confirmation dialog
```

#### Component Details

**`purchase-order-form-sheet.tsx`**
- Title: "Pesanan Baru"
- Description: "Buat pesanan pembelian baru. Pilih produk dan tentukan jumlah yang dipesan."
- Submit label: "Buat Pesanan"
- Fields: Supplier Combobox, Warehouse Combobox, dynamic item rows with "Tambah Item" button
- Each item row: Variant Combobox (searchable by name/SKU), Jumlah (quantity), Harga Satuan Rp (unit cost), remove button (X icon)
- Live total calculation via `form.Subscribe` formatted as IDR
- Form validation via Zod: supplier required, warehouse required, min 1 item, each item requires variant, positive quantity, non-negative cost
- Form resets on sheet open
- Uses `useSuppliers`, `useWarehouses`, `useVariants` to populate combobox options

**`purchase-order-badges.tsx`**
- `StatusBadge`: Small rounded pill (`px-2.5 py-0.5 text-xs`) with color-coded styles per status
- `LargeStatusBadge`: Larger variant (`px-4 py-1.5 text-sm`) for detail page headers
- `PaymentStatusBadge`: Small rounded pill for payment status
- Status labels (Indonesian): Pending, Dikonfirmasi, Dikirim, Diterima, Selesai, Dibatalkan
- Payment status labels (Indonesian): Belum Bayar, Dibayar Sebagian, Lunas
- `formatRupiah(amount)`: Utility for IDR currency formatting
- All badges support dark mode via `dark:` variant styles

**`delete-dialog.tsx`**
- Reusable `Dialog` with confirm/cancel buttons
- Default labels: confirm = "Ya, Hapus", cancel = "Batalkan"
- Loading state: "Menghapus..." on confirm button while pending
- Accepts `title`, `description` (ReactNode), `onConfirm`, `isPending`

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `purchaseOrder:view` permission, When they `GET /purchase-orders`, Then they receive a paginated list of purchase orders scoped to their organization with serialized Date/Decimal fields and included supplier, warehouse, and items
- **AC-002**: Given an authenticated user with `purchaseOrder:create` permission, When they `POST /purchase-orders` with valid body including at least one item, Then the purchase order is created (201) with status `PENDING` and payment status `UNPAID`, and an audit log entry is written
- **AC-003**: Given a PENDING purchase order, When `PATCH /purchase-orders/:id` sets status to `CONFIRMED`, Then the status transitions to `CONFIRMED` (200)
- **AC-004**: Given a PENDING purchase order, When `PATCH /purchase-orders/:id` attempts to set status to `SHIPPED`, Then a `400` is returned with message "Cannot transition from PENDING to SHIPPED"
- **AC-005**: Given a CONFIRMED or SHIPPED purchase order, When `POST /purchase-orders/:id/receive` is called with item quantities, Then the order status becomes `RECEIVED`, item `receivedQty` is incremented, stock movements are created with `type: 'IN'`, and variant stock is incremented
- **AC-006**: Given a PENDING purchase order, When `POST /purchase-orders/:id/receive` is called, Then a `400` is returned with message "Cannot receive items on a pending purchase order"
- **AC-007**: Given a RECEIVED purchase order where all items have `receivedQty >= quantity`, When `PATCH /purchase-orders/:id` sets status to `COMPLETED`, Then the status transitions to `COMPLETED`
- **AC-008**: Given a RECEIVED purchase order where not all items are fully received, When `PATCH /purchase-orders/:id` sets status to `COMPLETED`, Then a `400` is returned with message "Cannot complete order: not all items have been fully received"
- **AC-009**: Given a COMPLETED or CANCELLED purchase order, When any `PATCH` is attempted, Then a `400` is returned with message "Cannot modify a {status} purchase order"
- **AC-010**: Given a non-PENDING purchase order, When `DELETE /purchase-orders/:id` is called, Then a `400` is returned with message "Cannot delete a {status} purchase order"
- **AC-011**: Given a PENDING purchase order, When `DELETE /purchase-orders/:id` is called, Then the order is permanently deleted (200)
- **AC-012**: Given `PATCH /purchase-orders/:id` with `amountPaid: 50000` on an order with total 100000 and current amountPaid 0, Then `amountPaid` is set to 50000 and `paymentStatus` becomes `PARTIALLY_PAID`
- **AC-013**: Given `PATCH /purchase-orders/:id` with `amountPaid: 150000` on an order with total 100000 and current amountPaid 0, Then `amountPaid` is capped to 100000 and `paymentStatus` becomes `PAID`
- **AC-014**: Given the list endpoint, When `status`, `paymentStatus`, `supplierId`, or `warehouseId` query parameters are provided, Then results are filtered accordingly
- **AC-015**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-016**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods (state machine transitions, payment accumulation, receive logic), integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `purchase-orders.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern with `mock.module` for service isolation
- **Test Data Management**: Mock service with `mock()` from `bun:test`; mock auth plugin injects static user/org context
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (400 invalid transition, 400 cannot receive, 400 cannot delete, 404 not found), permission checks, validation errors (422 for invalid UUID, missing fields, empty items, zero quantity)

### Backend Test Cases

| Test Case | Endpoint | Expected |
|-----------|----------|----------|
| Returns paginated list | `GET /purchase-orders` | 200 with `data[]` and `meta` |
| Accepts status filter | `GET /purchase-orders?status=PENDING` | 200 |
| Accepts paymentStatus filter | `GET /purchase-orders?paymentStatus=UNPAID` | 200 |
| Accepts supplierId filter | `GET /purchase-orders?supplierId=...` | 200 |
| Accepts warehouseId filter | `GET /purchase-orders?warehouseId=...` | 200 |
| Accepts sort params | `GET /purchase-orders?sortBy=createdAt&sortOrder=asc` | 200 |
| Returns 422 for invalid status | `GET /purchase-orders?status=INVALID` | 422 |
| Returns 422 for invalid paymentStatus | `GET /purchase-orders?paymentStatus=INVALID` | 422 |
| Returns 422 for invalid sortBy | `GET /purchase-orders?sortBy=invalidField` | 422 |
| Creates with 201 | `POST /purchase-orders` (valid body) | 201 |
| Accepts optional orderedAt and note | `POST /purchase-orders` (with orderedAt, note) | 201 |
| Returns 422 when supplierId missing | `POST /purchase-orders` (no supplierId) | 422 |
| Returns 422 when items empty | `POST /purchase-orders` (items: []) | 422 |
| Returns 422 when quantity zero | `POST /purchase-orders` (quantity: 0) | 422 |
| Returns 422 when supplierId not UUID | `POST /purchase-orders` (supplierId: "not-a-uuid") | 422 |
| Returns detail by ID | `GET /purchase-orders/:id` | 200 with supplier, warehouse, items |
| Returns 404 for unknown ID | `GET /purchase-orders/:id` (unknown) | 404 |
| Returns 422 for invalid UUID | `GET /purchase-orders/not-a-uuid` | 422 |
| Updates status to CONFIRMED | `PATCH /purchase-orders/:id` { status: 'CONFIRMED' } | 200 |
| Updates paymentStatus | `PATCH /purchase-orders/:id` { paymentStatus: 'PAID' } | 200 |
| Returns 400 for invalid transition | `PATCH /purchase-orders/:id` { status: 'SHIPPED' } from PENDING | 400 |
| Returns 400 for incomplete receipt | `PATCH /purchase-orders/:id` { status: 'COMPLETED' } | 400 |
| Returns 422 for RECEIVED via PATCH | `PATCH /purchase-orders/:id` { status: 'RECEIVED' } | 422 |
| Returns 404 for unknown ID on update | `PATCH /purchase-orders/:id` (unknown) | 404 |
| Returns 422 for invalid status value | `PATCH /purchase-orders/:id` { status: 'INVALID' } | 422 |
| Receives items | `POST /purchase-orders/:id/receive` (valid items) | 200 |
| Returns 404 for unknown ID on receive | `POST /purchase-orders/:id/receive` (unknown) | 404 |
| Returns 400 when status prevents receive | `POST /purchase-orders/:id/receive` (PENDING) | 400 |
| Returns 422 when items empty on receive | `POST /purchase-orders/:id/receive` (items: []) | 422 |
| Returns 422 when receivedQty zero | `POST /purchase-orders/:id/receive` (receivedQty: 0) | 422 |
| Returns 422 when itemId not UUID | `POST /purchase-orders/:id/receive` (itemId: "not-a-uuid") | 422 |
| Returns 422 for invalid order UUID on receive | `POST /purchase-orders/not-a-uuid/receive` | 422 |
| Deletes PENDING order | `DELETE /purchase-orders/:id` (PENDING) | 200 |
| Returns 400 when not PENDING | `DELETE /purchase-orders/:id` (CONFIRMED) | 400 |
| Returns 404 for unknown ID on delete | `DELETE /purchase-orders/:id` (unknown) | 404 |
| Returns 422 for invalid UUID on delete | `DELETE /purchase-orders/not-a-uuid` | 422 |

## 7. Rationale & Context

### Why a State Machine Instead of Free-Form Status?
Purchase orders represent a real-world procurement workflow with legal and operational implications. Enforcing valid transitions at the service level prevents data corruption (e.g., marking an order as completed before goods are received) and provides clear business rules that both backend and frontend can rely on. The `STATUS_TRANSITIONS` map makes the allowed paths explicit and auditable.

### Why Permanent Delete Instead of Soft Delete?
Unlike products and variants which have broad downstream references and are core catalog data, purchase orders are transactional documents. Only PENDING orders (which have no stock movements or financial impact) can be deleted. Once an order progresses past PENDING, it must be CANCELLED instead -- preserving the audit trail for financial reporting and inventory reconciliation.

### Why No Separate Item Management API?
Items are created inline with the purchase order and are not independently modifiable after creation. This simplifies the data model and avoids complex partial-update scenarios. If an order needs modification, the typical business flow is to cancel it and create a new one (while still PENDING) or adjust quantities during receipt.

### Why Automatic Stock Movements on Receive?
When items are physically received at the warehouse, inventory must be updated immediately to reflect reality. The `receivePurchaseOrder` service method runs in a Prisma transaction to atomically (a) update received quantities, (b) create `StockMovement` records for audit trail, and (c) increment `ProductVariant.stock`. This ensures data consistency even if the process fails partway through.

### Why Additive Payment Tracking?
Businesses often pay suppliers in installments (partial payments). The `amountPaid` field accumulates payments over time. The service caps the total at the order total and auto-derives `paymentStatus` (`UNPAID` -> `PARTIALLY_PAID` -> `PAID`), keeping the payment state consistent without requiring manual status management.

### Why Indonesian UI Text?
BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all purchase order data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Supplier** - Required reference on every purchase order; provides the supplier context
- **DAT-002**: **Warehouse** - Required reference on every purchase order; determines where received stock is stored
- **DAT-003**: **ProductVariant** - Referenced by each purchase order item; stock is incremented on receipt
- **DAT-004**: **StockMovement** - Created automatically on receive with `type: 'IN'`, `referenceType: 'purchase_order'`, and `referenceId` set to the purchase order ID
- **DAT-005**: **AuditLog** - All write operations (create, update, receive, delete) must be logged with user identity and operation details

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management; provides enum types for status management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation, optimistic updates)
- **PLT-004**: **TanStack Form** - Form state management with Zod validation
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Combobox, Button, Input, Label)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, receive, delete) must be logged with user identity and operation details
- **COM-002**: **Organization scoping** - All queries are filtered by `organizationId` to enforce multi-tenant data isolation

## 9. Examples & Edge Cases

### 9.1 Backend Service: State Transition Validation

```typescript
const STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CANCELLED'],
  RECEIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TERMINAL_STATUSES: PurchaseOrderStatus[] = ['COMPLETED', 'CANCELLED'];

// In updatePurchaseOrder:
if (TERMINAL_STATUSES.includes(existing.status)) {
  return { error: `Cannot modify a ${existing.status.toLowerCase()} purchase order` };
}

if (data.status) {
  const allowed = STATUS_TRANSITIONS[existing.status];
  if (!allowed.includes(data.status)) {
    return { error: `Cannot transition from ${existing.status} to ${data.status}` };
  }
}
```

### 9.2 Backend Service: Receive with Stock Movements

```typescript
async receivePurchaseOrder(organizationId, id, receivedItems) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId },
    include: { items: true },
  });

  if (!['CONFIRMED', 'SHIPPED'].includes(order.status)) {
    return { error: `Cannot receive items on a ${order.status.toLowerCase()} purchase order` };
  }

  await prisma.$transaction(async (tx) => {
    for (const received of receivedItems) {
      const item = order.items.find(i => i.id === received.itemId);
      if (!item) continue;

      // 1. Update item received quantity (additive)
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.receivedQty + received.receivedQty },
      });

      // 2. Create stock movement record
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: order.warehouseId,
          variantId: item.variantId,
          type: 'IN',
          quantity: received.receivedQty,
          referenceId: order.id,
          referenceType: 'purchase_order',
        },
      });

      // 3. Increment variant stock (denormalized)
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: received.receivedQty } },
      });
    }

    // 4. Transition order to RECEIVED
    await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
    });
  });
}
```

### 9.3 Backend Service: Payment Accumulation

```typescript
// In updatePurchaseOrder, when amountPaid is provided:
if (data.amountPaid !== undefined) {
  const orderTotal = existing.items.reduce(
    (sum, item) => sum + Number(item.unitCost) * item.quantity,
    0,
  );
  const currentPaid = Number(existing.amountPaid);
  const newPaid = currentPaid + data.amountPaid;
  const cappedPaid = Math.min(newPaid, orderTotal);

  if (cappedPaid >= orderTotal) {
    data.paymentStatus = 'PAID';
  } else if (cappedPaid > 0) {
    data.paymentStatus = 'PARTIALLY_PAID';
  } else {
    data.paymentStatus = 'UNPAID';
  }
  data.amountPaid = cappedPaid;
}
```

### 9.4 Edge Cases

- **Invalid status transition via PATCH**: Attempting `PENDING -> SHIPPED` returns 400 with "Cannot transition from PENDING to SHIPPED" -- intermediate steps must be followed
- **COMPLETED without full receipt**: Attempting to complete when `receivedQty < quantity` on any item returns 400 with "Cannot complete order: not all items have been fully received"
- **RECEIVED via PATCH**: Setting `status: 'RECEIVED'` via PATCH returns 422 because `RECEIVED` is not in the `updatePurchaseOrderDto` status enum -- must use the receive endpoint
- **Receiving from wrong status**: Calling `/receive` on a PENDING, RECEIVED, COMPLETED, or CANCELLED order returns 400
- **Deleting non-PENDING order**: Calling DELETE on a CONFIRMED, SHIPPED, etc. order returns 400 with "Cannot delete a {status} purchase order"
- **Payment overpay**: Sending `amountPaid` that exceeds order total is capped to the order total; `paymentStatus` is set to `PAID`
- **Receive with unknown itemId**: If a received `itemId` does not match any item on the order, it is silently skipped (`continue`)
- **Partial receive**: Items can be received in multiple partial shipments; `receivedQty` accumulates across multiple receive calls
- **No search parameter**: The list endpoint does not support free-text search, unlike the products module -- filtering is done via specific fields only

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/purchase-orders/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission` with actions `view`, `create`, `update`, `receive`, `delete`
3. **Serialization**: All Date fields return ISO 8601 strings; Decimal fields (`amountPaid`, `unitCost`) return strings
4. **State machine**: Status transitions are validated against `STATUS_TRANSITIONS` map; terminal statuses block all modifications
5. **Completion guard**: Transition to `COMPLETED` requires all items to have `receivedQty >= quantity`
6. **Receipt isolation**: `RECEIVED` status is only set via the dedicated `/receive` endpoint, not via PATCH
7. **Stock movement**: Receiving items atomically creates `StockMovement` records and increments `ProductVariant.stock`
8. **Payment tracking**: `amountPaid` accumulation is additive and capped; `paymentStatus` is auto-derived
9. **Permanent delete**: Only `PENDING` orders can be deleted; no soft-delete pattern
10. **Pagination**: List endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`, `status`, `paymentStatus`, `supplierId`, `warehouseId`; returns `{ data, meta }`
11. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
12. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
13. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `bySupplier(id)`, `byWarehouse(id)`
14. **Cache invalidation**: Mutations invalidate the correct query key scopes including cross-module dependencies (`variantKeys`, `auditLogKeys`)
15. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
16. **Permission guards**: Create/edit/delete/receive UI elements gated by `useHasPermission`

## 11. Changelog (from previous version)

N/A -- This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Prisma schema: `packages/backend/prisma/schema.prisma` (PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PurchaseOrderPaymentStatus enums)
- Stock movement model: `packages/backend/prisma/schema.prisma` (StockMovement with `referenceType: 'purchase_order'`)
- Products module spec: `specs/products/spec-v1.md` (reference template)
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Suppliers module: `packages/frontend/src/modules/suppliers/index.ts` (supplier combobox data source)
- Warehouses module: `packages/frontend/src/modules/warehouses/index.ts` (warehouse combobox data source)
- Products/variants module: `packages/frontend/src/modules/products/index.ts` (variant combobox data source, variantKeys for cache invalidation)
- Audit logs module: `packages/frontend/src/modules/audit-logs/hooks/use-audit-logs.ts` (auditLogKeys for cache invalidation)
