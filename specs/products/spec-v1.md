---
title: Products, Variants & Product Categories Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: products
tags: [products, variants, categories, crud, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the products domain in BearUang. It covers three closely related resources: **Products**, **Product Variants**, and **Product Categories**. This spec serves as the reference template for building new modules that follow the same patterns.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugins, service layer, Prisma models, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components, routes, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Conventions**: file naming, code organization, permission model, soft-delete, audit logging, offline sync

**Audience**: Developers building new modules or modifying the products domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Resource** | A domain entity exposed via CRUD API endpoints (e.g., Product, Variant) |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and Prisma queries (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date/Decimal types to JSON-safe ISO strings/numbers before API response |
| **Soft Delete** | Setting `deletedAt` timestamp instead of removing the row; queries filter by `deletedAt: null` |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for create/edit forms |
| **Combobox** | A searchable dropdown component for selecting related entities |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **Dexie** | IndexedDB wrapper used for offline data persistence in the POS module |
| **Slug** | A URL-friendly identifier derived from a name (`/^[a-z0-9_-]+$/`) |
| **UUID v7** | Time-sortable UUID generated via `dbgenerated("uuidv7()")` |
| **SKU** | Stock Keeping Unit — a unique identifier for each variant within an organization |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: Each module resides in `packages/backend/src/modules/{resource-name}/` with at minimum a `.route.ts` and `.service.ts` file
- **REQ-002**: Route plugins are Elysia instances with `{ prefix: '/resource-name', tags: ['Resource Name'] }`
- **REQ-003**: All route plugins must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { resource: ['action'] }` where actions are `view`, `create`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: Decimal fields use `z.any()` in response schemas because they are serialized to `number` at runtime
- **REQ-009**: `serialize*` functions convert Prisma types (Date -> ISO string, Decimal -> number) before returning to client
- **REQ-010**: All Prisma queries are scoped by `organizationId` and `deletedAt: null` (or `deletedAt: { not: null }` for trashed)
- **REQ-011**: All write operations call `void logAudit(...)` with `model`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: Unique constraint violations (Prisma P2002) must return `409 Conflict` with a descriptive message
- **REQ-014**: Not-found scenarios return `404` with `{ message: string }`

### 3.2 Service Layer

- **REQ-015**: Services are exported as object literals: `export const {resourceName}Service = { async method() {...} }`
- **REQ-016**: List endpoints use `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-017**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-018**: Search uses case-insensitive `contains` on relevant text fields (name, slug, sku)
- **REQ-019**: Soft delete sets `deletedAt` to `new Date()`; restore sets it to `null`
- **REQ-020**: Parent delete cascades soft-delete to children via Prisma transaction

### 3.3 Frontend Architecture

- **REQ-021**: Each module resides in `packages/frontend/src/modules/{resource-name}/` with `hooks/`, `components/`, and `index.ts`
- **REQ-022**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-{resource-name}.ts`
- **REQ-023**: Query key factories are defined in `hooks/query-keys.ts` as hierarchical objects
- **REQ-024**: Cache invalidation must target the correct query key scope after mutations
- **REQ-025**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-026**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-md`)
- **REQ-027**: Delete confirmations use shadcn `Dialog`; restore confirmations use `AlertDialog`
- **REQ-028**: List pages use `DataTable` (TanStack Table wrapper) with manual sorting, server-side pagination, debounced search
- **REQ-029**: Permission-gated UI via `useHasPermission('resource:action')`
- **REQ-030**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-031**: Currency formatted as IDR; dates formatted with `id-ID` locale

### 3.4 Database

- **REQ-032**: All models use UUID v7 primary keys (`@id @default(dbgenerated("uuidv7()")) @db.Uuid`)
- **REQ-033**: All models have `organizationId` field with an index for multi-tenant scoping
- **REQ-034**: All models support soft delete via `deletedAt DateTime?`
- **REQ-035**: Slug fields use `@@unique([organizationId, slug])` composite unique constraint
- **REQ-036**: Models use `@@map("snake_case_table_name")` for database table naming
- **REQ-037**: Foreign keys use `onDelete: Cascade` for owned children, `SetNull` for optional references

### 3.5 Constraints

- **CON-001**: Hyphenated resource names (e.g., `product-categories`) require bracket notation in Eden client: `api['product-categories']`
- **CON-002**: Prisma Decimal fields cannot be directly validated by Zod — use `z.any()` in response schemas and serialize with `.toNumber()`
- **CON-003**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-004**: Offline sync via Dexie only covers read-heavy modules (products, variants, categories)
- **CON-005**: Variant stock is denormalized — only StockMovement service may write to it

### 3.6 Guidelines

- **GUD-001**: Co-locate shared schemas (mediaSchema, imageSchema) when duplicated across modules — consider extracting to a shared file
- **GUD-002**: Prefer `findUniqueOrThrow` over `findUnique` with manual null check when the record must exist
- **GUD-003**: Use `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-004**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-005**: Barrel export (`index.ts`) at every module/hooks/components directory level

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Products

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/products` | List products (paginated, searchable, filterable by category) | `product:view` | `{ data: Product[], meta: PaginationMeta }` |
| POST | `/products` | Create product | `product:create` | `201 Product` |
| GET | `/products/trashed` | List soft-deleted products | `product:view` | `{ data: Product[], meta: PaginationMeta }` |
| POST | `/products/:id/restore` | Restore soft-deleted product | `product:delete` | `{ message }` |
| GET | `/products/:id` | Get product detail (with variants and images) | `product:view` | `Product` |
| PATCH | `/products/:id` | Update product | `product:update` | `{ message }` |
| DELETE | `/products/:id` | Soft-delete product (cascades to variants) | `product:delete` | `{ message }` |
| POST | `/products/:id/images` | Add image to product | `product:update` | `201 ProductImage` |
| DELETE | `/products/:id/images/:imageId` | Remove image from product | `product:update` | `{ message }` |
| PATCH | `/products/:id/images/reorder` | Reorder product images | `product:update` | `{ message }` |

#### Variants

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/products/:id/variants` | List all variants for a product | `productVariant:view` | `Variant[]` |
| POST | `/products/:id/variants` | Create variant for a product | `productVariant:create` | `201 Variant` |
| GET | `/variants` | Global variant search (paginated) | `productVariant:view` | `{ data: VariantWithProduct[], meta }` |
| GET | `/variants/lookup?sku=xxx` | Lookup variant by exact SKU | `productVariant:view` | `VariantWithProduct` or `404` |
| GET | `/variants/trashed` | List soft-deleted variants | `productVariant:view` | `{ data: VariantWithProduct[], meta }` |
| POST | `/variants/:id/restore` | Restore variant | `productVariant:delete` | `{ message }` |
| GET | `/variants/:id` | Get variant detail | `productVariant:view` | `VariantWithProduct` |
| PATCH | `/variants/:id` | Update variant | `productVariant:update` | `{ message }` or `409` |
| DELETE | `/variants/:id` | Soft-delete variant | `productVariant:delete` | `{ message }` |
| POST | `/variants/:id/images` | Add image to variant | `productVariant:update` | `201 VariantImage` |
| DELETE | `/variants/:id/images/:imageId` | Remove image from variant | `productVariant:update` | `{ message }` |

#### Product Categories

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/product-categories` | List categories (paginated, filterable by parentId) | `productCategory:view` | `{ data: ProductCategory[], meta }` |
| POST | `/product-categories` | Create category | `productCategory:create` | `201 ProductCategory` |
| GET | `/product-categories/trashed` | List soft-deleted categories | `productCategory:view` | `{ data: TrashedProductCategory[], meta }` |
| POST | `/product-categories/:id/restore` | Restore category | `productCategory:delete` | `{ message }` |
| GET | `/product-categories/:id/products` | List products in category tree (recursive) | `productCategory:view` + `product:view` | `{ data: Product[], meta }` |
| GET | `/product-categories/:id` | Get category detail | `productCategory:view` | `ProductCategory` |
| PATCH | `/product-categories/:id` | Update category | `productCategory:update` | `{ message }` |
| DELETE | `/product-categories/:id` | Soft-delete category (orphans children, clears product refs) | `productCategory:delete` | `{ message }` |

### 4.2 Query Parameters (List Endpoints)

```typescript
interface PaginationQuery {
  page: number;       // default: 1
  pageSize: number;   // default: 10
  sortBy?: string;    // sortable field name
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
  search?: string;    // case-insensitive search on name/slug/sku
}

// Products additionally accept:
interface ListProductsQuery extends PaginationQuery {
  categoryId?: string | null;  // 'null' string means "uncategorized"
}

// Categories additionally accept:
interface ListCategoriesQuery extends PaginationQuery {
  parentId?: string | null;    // 'null' string means "root categories"
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

#### Product

```typescript
const productSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  categoryId: z.string().nullable(),
  category: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  variants: z.array(variantSchema),
  images: z.array(productImageSchema),
});

const createProductDto = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/, 'Slug hanya boleh berisi huruf kecil, angka, strip, dan garis bawah'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

const updateProductDto = createProductDto.partial(); // All fields optional
```

#### Variant

```typescript
const variantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  organizationId: z.string(),
  sku: z.string(),
  name: z.string(),
  price: z.any(),         // Decimal serialized to number
  stock: z.number(),       // Denormalized, managed by StockMovement
  unit: z.string(),
  attributes: z.any(),     // JSON object
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  images: z.array(variantImageSchema),
});

const variantWithProductSchema = variantSchema.extend({
  product: z.object({ name: z.string() }),
});

const createVariantDto = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const updateVariantDto = createVariantDto.partial();
```

#### Product Category

```typescript
const productCategorySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  parentId: z.string().nullable(),
  parent: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable(),
  children: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), sortOrder: z.number() })),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  _count: z.object({ products: z.number() }),
});

const createProductCategoryDto = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateProductCategoryDto = createProductCategoryDto.partial();
```

#### Image Schemas

```typescript
const mediaSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  purpose: z.string().nullable(),
  url: z.string(),
  createdAt: z.iso.datetime(),
});

const productImageSchema = z.object({
  id: z.string(),
  productId: z.string(),
  mediaId: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  media: mediaSchema,
});

const variantImageSchema = productImageSchema.omit({ productId: true }).extend({
  variantId: z.string(),
});
```

### 4.5 Prisma Models

```prisma
model ProductCategory {
  id             String            @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  parentId       String?           @db.Uuid
  parent         ProductCategory?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children       ProductCategory[] @relation("CategoryTree")
  name           String
  slug           String
  description    String?
  sortOrder      Int               @default(0)
  isActive       Boolean           @default(true)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  deletedAt      DateTime?

  products Product[]

  @@unique([organizationId, slug])
  @@index([organizationId])
  @@index([parentId])
  @@map("product_category")
}

model Product {
  id             String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  organizationId String
  categoryId     String?           @db.Uuid
  category       ProductCategory?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  name           String
  slug           String
  description    String?
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  variants ProductVariant[]
  images   ProductImage[]

  @@unique([organizationId, slug])
  @@index([organizationId])
  @@index([categoryId])
  @@map("product")
}

model ProductVariant {
  id             String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  productId      String    @db.Uuid
  product        Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  organizationId String
  sku            String
  name           String
  price          Decimal   @db.Decimal(12, 2)
  stock          Int       @default(0)
  unit           String    @default("pcs")
  attributes     Json      @default("{}")
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  movements          StockMovement[]
  purchaseOrderItems PurchaseOrderItem[]
  salesOrderItems    SalesOrderItem[]
  images             VariantImage[]

  @@unique([organizationId, sku])
  @@index([productId])
  @@index([organizationId])
  @@map("product_variant")
}
```

### 4.6 Frontend Query Key Factories

```typescript
// products/hooks/query-keys.ts
export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (params: ListProductsQuery) => [...productKeys.lists(), params],
  trashed: () => [...productKeys.all, 'trashed'],
  trashedList: (params: ListProductsQuery) => [...productKeys.trashed(), params],
  details: () => [...productKeys.all, 'detail'],
  detail: (id: string) => [...productKeys.details(), id],
};

export const variantKeys = {
  all: ['variants'],
  lists: () => [...variantKeys.all, 'list'],
  list: (params: SearchVariantQuery) => [...variantKeys.lists(), params],
  trashed: () => [...variantKeys.all, 'trashed'],
  details: () => [...variantKeys.all, 'detail'],
  detail: (id: string) => [...variantKeys.details(), id],
  byProduct: (productId: string) => [...variantKeys.all, 'byProduct', productId],
};

export const productCategoryKeys = {
  all: ['productCategories'],
  lists: () => [...productCategoryKeys.all, 'list'],
  list: (params: ListProductCategoriesQuery) => [...productCategoryKeys.lists(), params],
  trashed: () => [...productCategoryKeys.all, 'trashed'],
  details: () => [...productCategoryKeys.all, 'detail'],
  detail: (id: string) => [...productCategoryKeys.details(), id],
};
```

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After creating a product:
queryClient.invalidateQueries({ queryKey: productKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a product:
queryClient.invalidateQueries({ queryKey: productKeys.lists() });
queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
queryClient.invalidateQueries({ queryKey: variantKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a product:
queryClient.invalidateQueries({ queryKey: productKeys.lists() });
queryClient.invalidateQueries({ queryKey: productCategoryKeys.lists() });

// After restoring a product:
queryClient.invalidateQueries({ queryKey: productKeys.lists() });
queryClient.invalidateQueries({ queryKey: productKeys.trashed() });

// After creating a variant:
queryClient.invalidateQueries({ queryKey: variantKeys.lists() });
queryClient.invalidateQueries({ queryKey: variantKeys.byProduct(productId) });
queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
```

### 4.8 Frontend Route Structure

```
_dashboard/
  products/
    route.tsx                    # Layout: <Outlet />
    index.tsx                    # Product list page (DataTable, create button, trashed link)
    $productId.tsx               # Product detail (header, variants table, trashed variants)
    trashed/
      index.tsx                  # Trashed products list with restore
  variants/
    $variantId.tsx               # Variant detail (info, images, stock movements)
  product-categories/
    route.tsx                    # Layout: <Outlet />
    index.tsx                    # Category list page
    $categoryId.tsx              # Category detail (sub-categories, products table)
    trashed/
      index.tsx                  # Trashed categories list with restore
```

### 4.9 Frontend Component Structure

```
modules/products/
  index.ts
  hooks/
    index.ts
    query-keys.ts
    use-products.ts              # All product query + mutation hooks
    use-variants.ts              # All variant query + mutation hooks
  components/
    index.ts
    product-form-sheet.tsx       # Sheet form: name, slug, description, category, isActive, images
    product-detail-header.tsx    # Header: back, name, status badge, edit/delete
    product-states.tsx           # LoadingError skeletons
    variants-table.tsx           # Embedded variant list (raw Table, not DataTable)
    variant-form-sheet.tsx       # Sheet form: SKU, name, price, unit, isActive, images
    delete-dialog.tsx            # Confirmation dialog for product/variant deletion
    trashed-variants-table.tsx   # Trashed variants with restore action
    empty-variants-state.tsx     # Empty state with "Tambah Varian Pertama" button
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `product:view` permission, When they `GET /products`, Then they receive a paginated list of products scoped to their organization with serialized Date/Decimal fields
- **AC-002**: Given an authenticated user with `product:create` permission, When they `POST /products` with valid body, Then the product is created (201) and an audit log entry is written
- **AC-003**: Given a product with variants, When the product is deleted (`DELETE /products/:id`), Then both the product and all its variants have `deletedAt` set
- **AC-004**: Given a variant with an existing SKU, When a new variant is created with the same SKU in the same organization, Then a `409 Conflict` is returned
- **AC-005**: Given a product category with children, When the parent is deleted, Then children have `parentId` set to `null` (orphaned, not deleted)
- **AC-006**: Given a soft-deleted product, When `POST /products/:id/restore` is called, Then `deletedAt` is cleared and the product reappears in normal listings
- **AC-007**: Given a list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on name (and slug/sku where applicable)
- **AC-008**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-009**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-010**: Given the frontend list page, When a user types in the search box, Then after a 300ms debounce the search query is synced to the URL and a server-side fetch is triggered

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `{resource-name}.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Use `prisma.$transaction` with rollback for isolated test data
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404, 409), permission checks, soft-delete/restore cycles
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses

## 7. Rationale & Context

### Why Soft Delete?
Products, variants, and categories are business-critical entities that should never be permanently destroyed via API. Soft delete preserves data integrity and allows recovery. The trashed view provides a safety net before permanent cleanup (which would be a separate admin operation).

### Why Denormalized Stock on Variants?
Stock is denormalized onto `ProductVariant.stock` for fast reads (especially in POS barcode lookup). The `StockMovement` service is the single writer for this field, ensuring consistency. The `/// Denormalized cache` Prisma doc comment signals this constraint.

### Why UUID v7?
UUID v7 is time-sortable, providing natural ordering by creation time without needing separate indexes. It avoids the fragmentation issues of UUID v4 while remaining globally unique.

### Why Separate Route Files for Variants?
Variants have both product-scoped endpoints (`/products/:id/variants`) and global endpoints (`/variants`, `/variants/:id`, `/variants/lookup`). A separate route plugin with `.group()` handles both URL patterns cleanly.

### Why Indonesian UI Text?
BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all product/variant/category data via Prisma ORM
- **EXT-002**: **S3-compatible object storage** - Stores product and variant images; public URLs generated via `getPublicUrl(key)`

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context
- **SVC-002**: **Dexie.js** - Client-side IndexedDB wrapper for offline product/variant/category data in POS

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **StockMovement** - Manages variant stock levels; any module creating stock adjustments must go through this service
- **DAT-002**: **PurchaseOrderItem / SalesOrderItem** - Reference variants; cascading delete from variant is blocked by these relations at the DB level
- **DAT-003**: **AI Assistant** - Consumes `productsService` and `variantsService` methods directly via tool calling; write operations through AI still produce audit logs and respect RBAC. See [AI spec](../ai/spec-v1.md).

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer with migration management
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation, optimistic updates)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe params
- **PLT-005**: **TanStack Table** - Headless table utility for data grids
- **PLT-006**: **shadcn/ui + Radix** - UI component primitives

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete, restore) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin Template

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { resourceService } from './resource.service'
import { errorResponse } from '#common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

const resourceSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
})

const createResourceDto = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

const updateResourceDto = createResourceDto.partial()

const listResourceQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .extend({ search: z.string().optional() })

const resourceIdParam = z.object({ id: z.string().uuid() })

function serializeResource(r: {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }
}

export const resourceRoute = new Elysia({
  prefix: '/resources',
  tags: ['Resources'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, search, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await resourceService.listResources(
      organization.id,
      {
        skip, take, search,
        orderBy: sortBy ? { field: sortBy, order: sortOrder ?? 'desc' } : undefined,
      },
    )
    return {
      data: data.map(serializeResource),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { resource: ['view'] },
    query: listResourceQuery,
    response: { 200: paginatedResponse(resourceSchema) },
    detail: { summary: 'List resources', description: '...' },
  })
  .post('/', async ({ _authType, organization, user, body, status }) => {
    const resource = await resourceService.createResource(organization.id, body)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Resource',
      operation: 'create',
      args: { data: body },
    })
    return status(201, serializeResource(resource))
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { resource: ['create'] },
    body: createResourceDto,
    response: { 201: resourceSchema },
    detail: { summary: 'Create a resource', description: '...' },
  })
  .get('/:id', async ({ organization, params, status }) => {
    const resource = await resourceService.getResource(organization.id, params.id)
    if (!resource) return status(404, { message: 'Resource not found' })
    return serializeResource(resource)
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { resource: ['view'] },
    params: resourceIdParam,
    response: { 200: resourceSchema, 404: errorResponse },
    detail: { summary: 'Get a resource', description: '...' },
  })
  .patch('/:id', async ({ _authType, organization, user, params, body, status }) => {
    const count = await resourceService.updateResource(organization.id, params.id, body)
    if (count.count === 0) return status(404, { message: 'Resource not found' })
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Resource',
      operation: 'update',
      args: { id: params.id, data: body },
    })
    return status(200, { message: 'Resource updated' })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { resource: ['update'] },
    params: resourceIdParam,
    body: updateResourceDto,
    response: { 200: errorResponse, 404: errorResponse },
    detail: { summary: 'Update a resource', description: '...' },
  })
  .delete('/:id', async ({ _authType, organization, user, params, status }) => {
    await resourceService.deleteResource(organization.id, params.id)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Resource',
      operation: 'delete',
      args: { id: params.id },
    })
    return status(200, { message: 'Resource deleted' })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { resource: ['delete'] },
    params: resourceIdParam,
    response: { 200: errorResponse },
    detail: { summary: 'Delete a resource', description: '...' },
  })
```

### 9.2 Backend Service Template

```typescript
import { prisma } from '#integrations/prisma'

interface ListParams {
  skip: number
  take: number
  search?: string
  orderBy?: { field: string; order: 'asc' | 'desc' }
}

export const resourceService = {
  async listResources(organizationId: string, params: ListParams) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { slug: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const orderBy = params.orderBy
      ? { [params.orderBy.field]: params.orderBy.order }
      : { createdAt: 'desc' as const }

    const [data, total] = await prisma.$transaction([
      prisma.resource.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy,
      }),
      prisma.resource.count({ where }),
    ])

    return { data, total }
  },

  async getResource(organizationId: string, id: string) {
    return prisma.resource.findFirst({
      where: { id, organizationId, deletedAt: null },
    })
  },

  async createResource(organizationId: string, data: { name: string; slug: string; description?: string; isActive?: boolean }) {
    return prisma.resource.create({
      data: { organizationId, ...data },
    })
  },

  async updateResource(organizationId: string, id: string, data: Record<string, unknown>) {
    return prisma.resource.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    })
  },

  async deleteResource(organizationId: string, id: string) {
    await prisma.resource.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  },

  async restoreResource(organizationId: string, id: string) {
    return prisma.resource.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    })
  },

  async listTrashedResources(organizationId: string, params: ListParams) {
    const where = {
      organizationId,
      deletedAt: { not: null as const },
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const orderBy = params.orderBy
      ? { [params.orderBy.field]: params.orderBy.order }
      : { createdAt: 'desc' as const }

    const [data, total] = await prisma.$transaction([
      prisma.resource.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy,
      }),
      prisma.resource.count({ where }),
    ])

    return { data, total }
  },
}
```

### 9.3 Frontend Hook Template

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#lib/api'
import { resourceKeys } from './query-keys'
import type { CreateResourceInput, UpdateResourceInput, ListResourceQuery } from '#modules/resources/resources.route'

export function useResources(params: ListResourceQuery) {
  return useQuery({
    queryKey: resourceKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.resources.get({ query: params })
      if (error) throw error
      return data
    },
  })
}

export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.resources({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateResourceInput) => {
      const { data, error } = await api.resources.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
    },
  })
}

export function useUpdateResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateResourceInput & { id: string }) => {
      const { data, error } = await api.resources({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
      queryClient.invalidateQueries({ queryKey: resourceKeys.detail(id) })
    },
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.resources({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
    },
  })
}
```

### 9.4 Edge Cases

- **SKU uniqueness across organization**: Creating a variant with a duplicate SKU in the same organization returns 409, even if the existing variant belongs to a different product
- **Category tree cycle prevention**: When editing a category's `parentId`, the frontend excludes the category and all its descendants from the Combobox options to prevent circular references
- **Filtering by "uncategorized"**: `categoryId=null` in the query string (the literal string "null") is transformed to `null` to find products without a category
- **Image upload race condition**: The submit button is disabled while any images are in uploading or error state to prevent incomplete submissions
- **Cross-module permission**: `GET /product-categories/:id/products` requires both `productCategory:view` and `product:view` permissions

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/{name}/` with `.route.ts`, `.service.ts`, `.test.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`
3. **Serialization**: All Date fields return ISO 8601 strings; all Decimal fields return numbers
4. **Soft delete**: DELETE sets `deletedAt`; separate trashed list endpoint; restore endpoint clears `deletedAt`
5. **Pagination**: List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder`, `search`; return `{ data, meta }`
6. **Audit logging**: All write operations call `void logAudit(...)` with correct model, operation, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list(params)`, `trashed()`, `detail(id)`
9. **Cache invalidation**: Mutations invalidate the correct query key scopes including cross-module dependencies
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **Permission guards**: Create/edit/delete UI elements gated by `useHasPermission`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- S3 integration: `packages/backend/src/integrations/s3.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- MultiFileUpload component: `packages/frontend/src/modules/uploads/components/multi-file-upload.tsx`
- Offline sync: `packages/frontend/src/lib/sync.ts`, `packages/frontend/src/lib/db.ts`
- AI Assistant: `specs/ai/spec-v1.md` — downstream consumer of products/variants/categories services via LLM tool calling
