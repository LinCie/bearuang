---
title: Sales Orders Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: sales-orders
tags: [sales-orders, order-management, state-machine, stock-deduction, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the sales orders domain in BearUang. It covers the **SalesOrder** and **SalesOrderItem** resources, including a finite state machine governing order lifecycle transitions, automatic stock deduction on shipment, guest order support, and payment tracking. Sales orders also support offline creation via the POS sync batch endpoint.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugins, service layer with state machine logic, Prisma models, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components (form sheet, badges, delete dialog), and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling, state transition validation
- **State machine**: Valid status transitions (PENDING → CONFIRMED → SHIPPED → DELIVERED → COMPLETED/CANCELLED) with automatic stock side-effects
- **Conventions**: file naming, code organization, permission model, permanent delete (no soft delete for orders), audit logging, offline sync

**Audience**: Developers building or modifying the sales orders domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Sales Order** | A customer order for one or more product variants, tracked through a lifecycle of statuses from PENDING to COMPLETED or CANCELLED |
| **Sales Order Item** | A line item within a sales order linking a ProductVariant with a quantity and unit price |
| **State Machine** | A finite set of valid status transitions; the service layer rejects illegal transitions with a `400` response |
| **Terminal Status** | A status from which no further transitions are possible (`COMPLETED` or `CANCELLED`) |
| **Stock Deduction** | Automatic decrement of `ProductVariant.stock` when a sales order transitions to `SHIPPED`, accompanied by a `StockMovement` (type `OUT`) record |
| **Stock Reversal** | Automatic increment of `ProductVariant.stock` when a shipped order is cancelled, accompanied by a `StockMovement` (type `IN`) record |
| **Guest Order** | An order placed for a non-registered customer, identified by `guestName` and optionally `guestEmail` instead of `customerId` |
| **Payment Method** | The method of payment for the order: `CASH`, `QRIS`, `TRANSFER`, or `CARD` |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date/Decimal types to JSON-safe ISO strings/string numbers before API response |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for the create form |
| **Combobox** | A searchable dropdown component for selecting related entities (customer, warehouse, variant) |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: Each module resides in `packages/backend/src/modules/{resource-name}/` with at minimum a `.route.ts` and `.service.ts` file
- **REQ-002**: Route plugins are Elysia instances with `{ prefix: '/sales-orders', tags: ['Sales Orders'] }`
- **REQ-003**: All route plugins must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { salesOrder: ['action'] }` where actions are `view`, `create`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: Decimal fields (`amountPaid`, `unitPrice`) are serialized to `z.string()` (via `.toString()`) in response schemas
- **REQ-009**: `serializeSalesOrder` function converts Prisma types (Date → ISO string, Decimal → string via `.toString()`) before returning to client
- **REQ-010**: All Prisma queries are scoped by `organizationId`
- **REQ-011**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-014**: Business validation failures return `400` with `{ message: string }`

### 3.2 Service Layer

- **REQ-015**: Services are exported as object literals: `export const salesOrdersService = { async method() {...} }`
- **REQ-016**: List endpoints use `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-017**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-018**: Search uses case-insensitive `contains` on `note`, `guestEmail`, and `guestName` fields
- **REQ-019**: Status transitions are enforced by the `STATUS_TRANSITIONS` map — only the explicitly listed transitions are allowed
- **REQ-020**: Terminal statuses (`COMPLETED`, `CANCELLED`) block all modifications
- **REQ-021**: Transitioning to `SHIPPED` triggers automatic stock deduction via `prisma.$transaction` — creates `StockMovement` (type `OUT`) records and decrements `ProductVariant.stock`
- **REQ-022**: Cancelling a `SHIPPED` order triggers automatic stock reversal via `prisma.$transaction` — creates `StockMovement` (type `IN`) records and increments `ProductVariant.stock`
- **REQ-023**: Stock deductions use the order's `warehouseId` as the warehouse for `StockMovement` records
- **REQ-024**: `shippedAt` is automatically set to `new Date()` when transitioning to `SHIPPED`
- **REQ-025**: `amountPaid` is additive — the update receives a payment amount that is added to the current `amountPaid`, capped at the order total
- **REQ-026**: `paymentStatus` is auto-resolved based on `amountPaid` vs order total: `UNPAID` (0), `PARTIALLY_PAID` (>0, <total), `PAID` (>=total)
- **REQ-027**: On creation, if a `paymentMethod` is provided, `paymentStatus` is set to `PAID` and `amountPaid` is set to the full order total
- **REQ-028**: Either `customerId` or `guestName` must be provided on create and update
- **REQ-029**: `warehouseId` is required on create; on update the warehouse is validated if changed
- **REQ-030**: All referenced `variantId`s are validated against the organization's variants on create
- **REQ-031**: Items are immutable after creation — the update endpoint only modifies header fields
- **REQ-032**: Permanent delete (not soft delete) is allowed only for `PENDING` or `CANCELLED` orders

### 3.3 Frontend Architecture

- **REQ-033**: Each module resides in `packages/frontend/src/modules/{resource-name}/` with `hooks/`, `components/`, and `index.ts`
- **REQ-034**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-sales-orders.ts`
- **REQ-035**: Query key factories are defined in `hooks/use-sales-orders.ts` as hierarchical objects with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `byCustomer(customerId)`, `byWarehouse(warehouseId)`
- **REQ-036**: Cache invalidation must target the correct query key scope after mutations, including cross-module keys for variants and audit logs
- **REQ-037**: Create form uses TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-038**: Create form uses shadcn `Sheet` component (slide-over, `sm:max-w-lg`)
- **REQ-039**: Delete confirmation uses shadcn `Dialog`
- **REQ-040**: The form supports a tabbed customer type selector: "Terdaftar" (existing customer via Combobox) or "Tamu" (guest name + optional email)
- **REQ-041**: The form includes a dynamic item list with variant Combobox, quantity, and unit price per item, plus a live total calculation
- **REQ-042**: Permission-gated UI via `useHasPermission('salesOrder:action')`
- **REQ-043**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-044**: Currency formatted as IDR using `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`

### 3.4 Database

- **REQ-045**: All models use UUID v7 primary keys (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-046**: All models have `organizationId` field with an index for multi-tenant scoping
- **REQ-047**: Models use `@@map("snake_case_table_name")` for database table naming
- **REQ-048**: Sales orders use permanent delete (`prisma.salesOrder.delete`), NOT soft delete
- **REQ-049**: `SalesOrderItem` uses `onDelete: Cascade` — deleting a sales order removes all its items
- **REQ-050**: `Customer` relation uses default (no cascade) — deleting a customer does not delete sales orders

### 3.5 Constraints

- **CON-001**: Hyphenated resource name `sales-orders` requires bracket notation in Eden client: `api['sales-orders']`
- **CON-002**: Decimal fields (`amountPaid`, `unitPrice`) cannot be directly validated by Zod — serialized to string via `.toString()` and declared as `z.string()` in response schemas
- **CON-003**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-004**: Stock deduction bypasses the `StockMovement` service and writes directly in the sales order service transaction — this is an intentional coupling for atomicity
- **CON-005**: Items cannot be modified after creation — no update or delete endpoints for `SalesOrderItem`
- **CON-006**: `amountPaid` on update is additive (receives a delta), not absolute — the service adds the delta to the current paid amount
- **CON-007**: Sales orders support offline creation via the POS sync batch endpoint — orders are created locally and synced when connectivity is available

### 3.6 Guidelines

- **GUD-001**: When displaying order status, use the `StatusBadge` and `LargeStatusBadge` components from `sales-order-badges.tsx`
- **GUD-002**: When displaying payment status, use the `PaymentStatusBadge` component
- **GUD-003**: Use `formatRupiah(amount)` from `sales-order-badges.tsx` for consistent IDR formatting
- **GUD-004**: Use `getStatusLabel(status)` and `getPaymentStatusLabel(status)` for programmatic label access
- **GUD-005**: Use `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-006**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-007**: Barrel export (`index.ts`) at every module/hooks/components directory level

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/sales-orders` | List sales orders (paginated, filterable by status, payment status, customer; searchable by note/guestEmail/guestName) | `salesOrder:view` | `{ data: SalesOrder[], meta: PaginationMeta }` |
| POST | `/sales-orders` | Create a sales order with line items | `salesOrder:create` | `201 SalesOrder` or `400` |
| GET | `/sales-orders/:id` | Get sales order detail with items and variant details | `salesOrder:view` | `SalesOrder` or `404` |
| PATCH | `/sales-orders/:id` | Update sales order header fields (status, payment, customer info, note, address) | `salesOrder:update` | `SalesOrder` or `400` or `404` |
| DELETE | `/sales-orders/:id` | Permanently delete a sales order (only PENDING or CANCELLED) | `salesOrder:delete` | `{ message }` or `400` or `404` |

### 4.2 Query Parameters (List Endpoint)

```typescript
interface PaginationQuery {
  page: number;       // default: 1
  pageSize: number;   // default: 10
  sortBy?: 'createdAt' | 'updatedAt' | 'orderedAt';
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
}

interface ListSalesOrdersQuery extends PaginationQuery {
  status?: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  customerId?: string;
  warehouseId?: string;
  search?: string;    // case-insensitive search on note, guestEmail, guestName
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

#### Sales Order

```typescript
const salesOrderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  customerId: z.string().nullable(),
  customer: z.object({ id: z.string(), name: z.string() }).nullable(),
  warehouseId: z.string(),
  warehouse: z.object({ id: z.string(), name: z.string() }),
  guestName: z.string().nullable(),
  guestEmail: z.string().nullable(),
  shippingAddress: z.any(),              // JSON object
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']),
  paymentMethod: z.string().nullable(),
  amountPaid: z.string(),                // Decimal serialized via .toString()
  orderedAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(salesOrderItemSchema),
});

const createSalesOrderDto = z.object({
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  shippingAddress: z.record(z.string(), z.any()).optional(),
  orderedAt: z.iso.datetime().optional(),
  note: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER', 'CARD']).optional(),
  items: z.array(createSalesOrderItemDto).min(1),
});

const updateSalesOrderDto = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER', 'CARD']).nullable().optional(),
  amountPaid: z.number().nonnegative().optional(),     // additive delta
  customerId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().optional(),
  guestName: z.string().nullable().optional(),
  guestEmail: z.string().email().nullable().optional(),
  shippingAddress: z.record(z.string(), z.any()).optional(),
  orderedAt: z.iso.datetime().nullable().optional(),
  shippedAt: z.iso.datetime().nullable().optional(),
  note: z.string().nullable().optional(),
});
```

#### Sales Order Item

```typescript
const salesOrderItemSchema = z.object({
  id: z.string(),
  salesOrderId: z.string(),
  variantId: z.string(),
  variant: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
  }),
  quantity: z.number().int(),
  unitPrice: z.string(),                // Decimal serialized via .toString()
});

const createSalesOrderItemDto = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});
```

### 4.5 State Machine

The sales order status follows a finite state machine. Transitions are validated by `STATUS_TRANSITIONS` in the service layer.

```
┌───────────┐       ┌────────────┐       ┌──────────┐       ┌───────────┐       ┌───────────┐
│  PENDING  │──────>│  CONFIRMED │──────>│  SHIPPED │──────>│ DELIVERED │──────>│ COMPLETED │
└─────┬─────┘       └─────┬──────┘       └────┬─────┘       └───────────┘       └───────────┘
      │                   │                   │
      │                   │                   │
      v                   v                   v
┌───────────┐       ┌───────────┐       ┌───────────┐
│ CANCELLED │       │ CANCELLED │       │ CANCELLED │
└───────────┘       └───────────┘       └───────────┘
```

**Valid transitions** (defined in `STATUS_TRANSITIONS`):

| From | Allowed To |
|------|-----------|
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | SHIPPED, CANCELLED |
| SHIPPED | DELIVERED, CANCELLED |
| DELIVERED | COMPLETED |
| COMPLETED | *(terminal — no transitions)* |
| CANCELLED | *(terminal — no transitions)* |

**Side-effects on transition:**

| Transition | Side-effect |
|-----------|-------------|
| → SHIPPED | Creates `StockMovement` (type `OUT`) per item; decrements `ProductVariant.stock`; sets `shippedAt` to current timestamp |
| SHIPPED → CANCELLED | Creates `StockMovement` (type `IN`) per item; increments `ProductVariant.stock` (reversal) |
| Any → COMPLETED | No side-effects |

### 4.6 Prisma Models

```prisma
enum SalesOrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED

  @@map("sales_order_status")
}

enum SalesOrderPaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID

  @@map("sales_order_payment_status")
}

model SalesOrder {
  id              String                  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId  String
  customerId      String?                 @db.Uuid
  customer        Customer?               @relation(fields: [customerId], references: [id])
  warehouseId     String                  @db.Uuid
  warehouse       Warehouse               @relation(fields: [warehouseId], references: [id])
  guestName       String?
  guestEmail      String?
  shippingAddress Json                    @default("{}")
  status          SalesOrderStatus        @default(PENDING)
  paymentStatus   SalesOrderPaymentStatus @default(UNPAID)
  paymentMethod   String?
  amountPaid      Decimal                  @default(0) @db.Decimal(12, 2)
  orderedAt       DateTime?
  shippedAt       DateTime?
  note            String?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  items SalesOrderItem[]

  @@index([organizationId])
  @@index([customerId])
  @@index([guestEmail])
  @@index([warehouseId])
  @@map("sales_order")
}

model SalesOrderItem {
  id           String         @id @default(dbgenerated("uuidv7()")) @db.Uuid
  salesOrderId String         @db.Uuid
  salesOrder   SalesOrder     @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  variantId    String         @db.Uuid
  variant      ProductVariant @relation(fields: [variantId], references: [id])
  quantity     Int
  unitPrice    Decimal        @db.Decimal(12, 2)

  @@index([salesOrderId])
  @@index([variantId])
  @@map("sales_order_item")
}
```

### 4.7 Frontend Query Key Factories

```typescript
// sales-orders/hooks/use-sales-orders.ts
export const salesOrderKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesOrderKeys.all, 'list'] as const,
  list: (params: ListSalesOrdersQuery) => [...salesOrderKeys.lists(), params] as const,
  details: () => [...salesOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderKeys.details(), id] as const,
  byCustomer: (customerId: string) => [...salesOrderKeys.all, 'byCustomer', customerId] as const,
  byWarehouse: (warehouseId: string) => [...salesOrderKeys.all, 'byWarehouse', warehouseId] as const,
};
```

### 4.8 Frontend Cache Invalidation Patterns

```typescript
// After creating a sales order:
queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: salesOrderKeys.byCustomer(variables.customerId) });  // conditional
queryClient.invalidateQueries({ queryKey: salesOrderKeys.byWarehouse(variables.warehouseId) }); // conditional
for (const item of variables.items) {
  queryClient.invalidateQueries({ queryKey: variantKeys.detail(item.variantId) });
}
queryClient.invalidateQueries({ queryKey: variantKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a sales order:
queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() });
queryClient.invalidateQueries({ queryKey: salesOrderKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: salesOrderKeys.byCustomer(variables.customerId) });  // conditional
queryClient.invalidateQueries({ queryKey: salesOrderKeys.byWarehouse(variables.warehouseId) }); // conditional
queryClient.invalidateQueries({ queryKey: variantKeys.all });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a sales order:
queryClient.invalidateQueries({ queryKey: salesOrderKeys.all });
queryClient.invalidateQueries({ queryKey: variantKeys.lists() });
queryClient.invalidateQueries({ queryKey: variantKeys.all });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

### 4.9 Frontend Component Structure

```
modules/sales-orders/
  index.ts                                # Barrel export: hooks + components
  hooks/
    index.ts                              # Barrel export
    use-sales-orders.ts                    # Query key factory + all query + mutation hooks
  components/
    sales-order-form-sheet.tsx             # Sheet form: customer type tabs, warehouse combobox, dynamic item list, live total
    sales-order-badges.tsx                 # StatusBadge, PaymentStatusBadge, LargeStatusBadge, formatRupiah, label helpers
    delete-dialog.tsx                      # Confirmation dialog for sales order deletion
```

### 4.10 Frontend Component Details

#### SalesOrderFormSheet

- **Type**: Controlled `Sheet` component (`open`, `onOpenChange`, `onSubmit`, `isPending`)
- **Customer type selection**: Tabs with two options:
  - "Terdaftar" (existing): Customer Combobox loaded via `useCustomers({ pageSize: 100 })`
  - "Tamu" (guest): Text inputs for `guestName` (required) and `guestEmail` (optional)
- **Warehouse selection**: Combobox loaded via `useWarehouses({ pageSize: 100 })`
- **Items section**: Dynamic list with:
  - Variant Combobox (loaded via `useVariants({ pageSize: 100 })`) with client-side filtering by name and SKU
  - Quantity input (`min: 1`)
  - Unit price input (`min: 0`, labeled "Harga Satuan (Rp)")
  - Remove button per item
  - "Tambah Item" button to add rows
- **Total summary**: Live-calculated via `form.Subscribe`, formatted as IDR
- **Validation**: TanStack Form with Zod (`validators.onBlur` for warehouse, `validators.onSubmit` for items)
- **Form reset**: All fields reset when sheet opens

#### Sales Order Badges

- **`StatusBadge`**: Small pill badge for order status (6 statuses, each with unique light/dark color scheme)
- **`LargeStatusBadge`**: Larger variant of StatusBadge for detail pages
- **`PaymentStatusBadge`**: Pill badge for payment status (3 statuses: UNPAID red, PARTIALLY_PAID amber, PAID green)
- **Status labels** (Indonesian): PENDING → "Pending", CONFIRMED → "Dikonfirmasi", SHIPPED → "Dikirim", DELIVERED → "Diterima", COMPLETED → "Selesai", CANCELLED → "Dibatalkan"
- **Payment status labels** (Indonesian): UNPAID → "Belum Bayar", PARTIALLY_PAID → "Dibayar Sebagian", PAID → "Lunas"
- **`formatRupiah(amount)`**: Formats number to IDR currency string with no decimal places

#### DeleteDialog

- **Type**: Controlled `Dialog` component (`open`, `onOpenChange`, `title`, `description`, `onConfirm`, `isPending`)
- **Default labels**: "Ya, Hapus" (confirm), "Batalkan" (cancel)
- **Loading state**: Confirm button shows "Menghapus..." while `isPending` is true

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `salesOrder:view` permission, When they `GET /sales-orders`, Then they receive a paginated list of sales orders scoped to their organization with serialized Date/Decimal fields
- **AC-002**: Given an authenticated user with `salesOrder:view` permission, When they `GET /sales-orders?status=PENDING`, Then only orders with status `PENDING` are returned
- **AC-003**: Given an authenticated user with `salesOrder:view` permission, When they `GET /sales-orders?paymentStatus=UNPAID`, Then only orders with payment status `UNPAID` are returned
- **AC-004**: Given an authenticated user with `salesOrder:view` permission, When they `GET /sales-orders?customerId={id}`, Then only orders for that customer are returned
- **AC-005**: Given an authenticated user with `salesOrder:view` permission, When they `GET /sales-orders?search=test`, Then orders are filtered by case-insensitive contains on `note`, `guestEmail`, or `guestName`
- **AC-006**: Given an authenticated user with `salesOrder:create` permission, When they `POST /sales-orders` with a valid body including `customerId` and items, Then the sales order is created (201) with status `PENDING` and payment status `UNPAID`, and an audit log entry is written
- **AC-007**: Given an authenticated user with `salesOrder:create` permission, When they `POST /sales-orders` with `guestName` instead of `customerId`, Then a guest order is created (201)
- **AC-008**: Given a create request with `paymentMethod: 'CASH'`, When the order is created, Then `paymentStatus` is set to `PAID` and `amountPaid` is set to the full order total (sum of `unitPrice * quantity` for all items)
- **AC-009**: Given a create request without `customerId` and without `guestName`, When the order is created, Then a `400` error is returned with message containing "customerId or guestName"
- **AC-010**: Given a create request with a non-existent `warehouseId`, When the order is created, Then a `400` error is returned with message "Warehouse not found"
- **AC-011**: Given a create request with a non-existent `variantId` in items, When the order is created, Then a `400` error is returned with message containing "variants not found"
- **AC-012**: Given a `PENDING` sales order, When `PATCH /sales-orders/:id` sets `status: 'CONFIRMED'`, Then the order status transitions to `CONFIRMED` (200)
- **AC-013**: Given a `CONFIRMED` sales order, When `PATCH /sales-orders/:id` sets `status: 'SHIPPED'`, Then the order status transitions to `SHIPPED`, `shippedAt` is set to the current timestamp, stock movements (type `OUT`) are created for each item, and `ProductVariant.stock` is decremented (200)
- **AC-014**: Given a `SHIPPED` sales order, When `PATCH /sales-orders/:id` sets `status: 'CANCELLED'`, Then the order status transitions to `CANCELLED`, stock movements (type `IN`) are created for each item, and `ProductVariant.stock` is incremented (reversal) (200)
- **AC-015**: Given a `PENDING` sales order, When `PATCH /sales-orders/:id` sets `status: 'COMPLETED'`, Then a `400` error is returned with message containing "Cannot transition from PENDING to COMPLETED"
- **AC-016**: Given a `COMPLETED` sales order, When any `PATCH` is attempted, Then a `400` error is returned with message "Cannot modify a completed sales order"
- **AC-017**: Given a `CANCELLED` sales order, When any `PATCH` is attempted, Then a `400` error is returned with message "Cannot modify a cancelled sales order"
- **AC-018**: Given a sales order update with `amountPaid: 50000`, When the current `amountPaid` is `20000` and the order total is `100000`, Then the new `amountPaid` is `70000` and `paymentStatus` becomes `PARTIALLY_PAID`
- **AC-019**: Given a sales order update with `amountPaid` that exceeds the remaining balance, When processed, Then `amountPaid` is capped at the order total and `paymentStatus` becomes `PAID`
- **AC-020**: Given a `PENDING` sales order, When `DELETE /sales-orders/:id` is called, Then the order and all its items are permanently deleted (200)
- **AC-021**: Given a `CONFIRMED` sales order, When `DELETE /sales-orders/:id` is called, Then a `400` error is returned with message "Cannot delete a confirmed sales order"
- **AC-022**: Given a non-existent sales order, When any endpoint referencing `:id` is called, Then a `404` error is returned
- **AC-023**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-024**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-025**: Given invalid query parameter values (e.g., `status=INVALID`), When the list endpoint is called, Then a `422` validation error is returned
- **AC-026**: Given the frontend form sheet, When the customer type tab changes from "Terdaftar" to "Tamu", Then the customer ID field is cleared and guest name/email fields are available
- **AC-027**: Given the frontend form sheet with items, When the total is displayed, Then it reflects the live sum of `quantity * unitPrice` for all items in IDR format

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for route handlers with mocked service layer
- **Frameworks**: `bun:test` for backend
- **Backend test file**: `sales-orders.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern with `mock.module` for service and auth plugin
- **Test Data Management**: Mock service with `mock(() => Promise.resolve(...))` for isolated test data
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**:
  - **List endpoint**: Paginated response, status filter, paymentStatus filter, customerId filter, search filter, sort params, invalid status (422), invalid paymentStatus (422), invalid sortBy (422)
  - **Create endpoint**: With customerId (201), with guest info (201), with optional fields (201), missing customer/guest (400), warehouse not found (400), variant not found (400), missing warehouseId (422), empty items (422), zero quantity (422), non-UUID customerId (422)
  - **Get endpoint**: Existing order (200), not found (404), invalid UUID (422)
  - **Update endpoint**: Update status (200), update paymentStatus (200), update shippingAddress (200), not found (404), invalid status (422), invalid UUID (422)
  - **Delete endpoint**: Success (200), non-deletable status (400), not found (404), invalid UUID (422)
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

## 7. Rationale & Context

### Why a State Machine for Order Status?
Sales orders represent a business workflow with a defined lifecycle. The state machine enforces valid transitions at the service layer, preventing invalid state changes (e.g., skipping from PENDING directly to SHIPPED). Terminal statuses (COMPLETED, CANCELLED) lock the order to prevent further modification after the workflow completes.

### Why Permanent Delete Instead of Soft Delete?
Sales orders are operational records with financial and inventory implications. Once an order progresses past PENDING or is CANCELLED, it should be preserved for audit and inventory tracking. Only orders that never entered the fulfillment pipeline (PENDING) or were explicitly reverted (CANCELLED) can be permanently deleted.

### Why Automatic Stock Deduction on Shipment?
Stock is deducted at shipment time (not at order creation) because an order may be cancelled before shipping. Deducting at the SHIPPED transition ensures inventory reflects actual outbound goods. The reversal mechanism on CANCELLED-from-SHIPPED restores stock, maintaining inventory accuracy.

### Why Guest Order Support?
Many small businesses (BearUang's target market) serve walk-in customers who are not registered in the system. Guest orders allow capturing these sales without requiring customer registration, using `guestName` and optionally `guestEmail` as the customer identifier.

### Why Additive Payment Tracking?
The `amountPaid` field uses additive updates (receiving a payment delta) rather than absolute values. This matches real-world payment workflows where customers may pay in installments. The service automatically resolves `paymentStatus` based on the running total vs order total.

### Why Offline Sync Support?
BearUang serves businesses that may operate in environments with intermittent connectivity (markets, remote locations). The POS module creates sales orders locally via Dexie/IndexedDB and syncs them through the sync batch endpoint when connectivity is restored.

### Why Items Are Immutable After Creation?
Once a sales order is created, its line items are locked to maintain consistency with inventory and financial records. Any changes to the order composition (adding/removing items, changing quantities or prices) would require order cancellation and re-creation, preserving a clear audit trail.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all sales order and item data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Customer** - Optional referenced entity for registered customer orders; `customerId` foreign key
- **DAT-002**: **Warehouse** - Required referenced entity; order stock is deducted from the specified warehouse
- **DAT-003**: **ProductVariant** - Required referenced entity for each order item; stock is decremented/incremented on shipment/cancellation
- **DAT-004**: **StockMovement** - Automatically created records when order transitions to SHIPPED (type `OUT`) or from SHIPPED to CANCELLED (type `IN`)
- **DAT-005**: **AuditLog** - All write operations (create, update, delete) are logged with user identity and operation details
- **DAT-006**: **POS / Sync** - Offline sales order creation via the sync batch endpoint; orders created in POS are synced to the backend

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation, optimistic updates)
- **PLT-004**: **TanStack Form** - Form state management with Zod validation
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Combobox, Tabs, Button, Input, Label)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin Template

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { salesOrdersService } from './sales-orders.service'
import { errorResponse } from '#common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

// Sales orders use createSalesOrderDto with items array
// Sales orders use updateSalesOrderDto with optional status, paymentStatus, amountPaid, etc.
// Sales orders use listSalesOrdersQuery with status, paymentStatus, customerId, warehouseId, search filters
// Serialization: Decimal → .toString(), Date → .toISOString()
// Eden client: api['sales-orders']
```

### 9.2 State Machine Validation

```typescript
// Invalid transition: PENDING → SHIPPED
// Service returns: { error: 'Cannot transition from PENDING to SHIPPED' }
// Route returns: 400 { message: 'Cannot transition from PENDING to SHIPPED' }

// Invalid transition: COMPLETED → CANCELLED
// Service returns: { error: 'Cannot modify a completed sales order' }
// Route returns: 400 { message: 'Cannot modify a completed sales order' }

// Valid transition: PENDING → CANCELLED
// Allowed by STATUS_TRANSITIONS['PENDING'] which includes 'CANCELLED'
```

### 9.3 Stock Deduction Flow

```typescript
// When status transitions to SHIPPED, the service executes a transaction:
// 1. For each item in the order:
//    a. Create StockMovement { type: 'OUT', quantity: item.quantity, warehouseId, variantId, referenceId: orderId, referenceType: 'sales_order' }
//    b. Update ProductVariant { stock: { decrement: item.quantity } }
// 2. Update SalesOrder { status: 'SHIPPED', shippedAt: new Date() }

// When a SHIPPED order is CANCELLED, the service executes a reversal transaction:
// 1. For each item in the order:
//    a. Create StockMovement { type: 'IN', quantity: item.quantity, warehouseId, variantId, referenceId: orderId, referenceType: 'sales_order' }
//    b. Update ProductVariant { stock: { increment: item.quantity } }
// 2. Update SalesOrder { status: 'CANCELLED' }
```

### 9.4 Payment Tracking Flow

```typescript
// On create with paymentMethod:
// paymentStatus = 'PAID', amountPaid = sum(unitPrice * quantity for all items)

// On update with amountPaid (additive delta):
// currentPaid = Number(existing.amountPaid)
// newPaid = currentPaid + delta
// cappedPaid = Math.min(newPaid, orderTotal)
// if (cappedPaid >= orderTotal) → paymentStatus = 'PAID'
// if (cappedPaid > 0) → paymentStatus = 'PARTIALLY_PAID'
// if (cappedPaid === 0) → paymentStatus = 'UNPAID'
```

### 9.5 Edge Cases

- **Stock going negative**: The service does not check for sufficient stock before deduction. If `ProductVariant.stock` is less than the order quantity, stock will go negative. This is a deliberate design choice to not block shipment operations; stock validation is expected at the order creation step in the frontend or POS workflow.
- **Customer/Guest mutation**: When updating a sales order, if `customerId` is set to `null` and `guestName` is also `null`, the service returns `400 "Either customerId or guestName must be provided"`. The service checks the merged result of existing + new values.
- **Cancel from SHIPPED reversal**: Cancelling a shipped order creates reversal stock movements and increments variant stock. If the order was shipped, then partially restocked (via other means), the reversal will still add the full quantity back, potentially resulting in inflated stock levels.
- **Concurrent status transitions**: Two simultaneous `PATCH` requests on the same order could both pass the state machine check before either commits. The database transaction ensures atomicity per request, but the application does not implement optimistic locking. This could lead to race conditions in high-concurrency scenarios.
- **Warehouse change after shipment**: The `updateSalesOrderDto` allows changing `warehouseId`, but stock movements reference the original `warehouseId` at the time of shipment. Changing the warehouse after shipment does not retroactively move stock.
- **Items array ordering**: Items in the create request are stored in the order provided. The list endpoint does not guarantee item ordering unless explicitly sorted by `createdAt` or `id`.
- **Empty items on create**: The Zod schema enforces `z.array(createSalesOrderItemDto).min(1)`, returning `422` if the items array is empty.
- **Non-UUID params**: All `:id` params are validated with `z.string().uuid()`, returning `422` for non-UUID values.
- **Guest email format**: The `guestEmail` field on create uses `z.string().email()` validation, but on update uses `z.string().email().nullable().optional()` — allowing null to clear the email.

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/sales-orders/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission` with `salesOrder` resource
3. **Serialization**: All Date fields return ISO 8601 strings; all Decimal fields (`amountPaid`, `unitPrice`) return strings via `.toString()`
4. **State machine**: Only transitions listed in `STATUS_TRANSITIONS` are allowed; terminal statuses block all modifications
5. **Stock deduction**: Transitioning to `SHIPPED` creates OUT stock movements and decrements variant stock atomically
6. **Stock reversal**: Cancelling from `SHIPPED` creates IN stock movements and increments variant stock atomically
7. **Pagination**: List endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`, `status`, `paymentStatus`, `customerId`, `warehouseId`, `search`; returns `{ data, meta }`
8. **Guest support**: Orders can be created with `guestName` instead of `customerId`; either is required
9. **Payment tracking**: `amountPaid` is additive with auto-resolved `paymentStatus`; creation with `paymentMethod` auto-sets full payment
10. **Permanent delete**: Only `PENDING` and `CANCELLED` orders can be deleted; uses `prisma.salesOrder.delete` (not soft delete)
11. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
12. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
13. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `byCustomer(id)`, `byWarehouse(id)`
14. **Cache invalidation**: Mutations invalidate the correct query key scopes including cross-module dependencies (variants, audit logs)
15. **Indonesian UI**: All user-facing text is in Bahasa Indonesia (status labels, form labels, button text)
16. **Permission guards**: Create/edit/delete UI elements gated by `useHasPermission('salesOrder:action')`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Stock movements module: `packages/backend/src/modules/stock-movements/`
- Customers module: `packages/backend/src/modules/customers/`
- Warehouses module: `packages/backend/src/modules/warehouses/`
- Products/variants module: `packages/backend/src/modules/products/`, `specs/products/spec-v1.md`
- POS module: `packages/frontend/src/modules/pos/`
- Sync module: `packages/frontend/src/lib/sync.ts`
- Product variants query keys (cross-module invalidation): `packages/frontend/src/modules/products/hooks/use-variants.ts`
- Audit log query keys (cross-module invalidation): `packages/frontend/src/modules/audit-logs/hooks/use-audit-logs.ts`
