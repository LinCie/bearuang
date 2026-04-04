---
title: Sync Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: sync
tags: [sync, offline, delta, initial, batch, mutations, indexeddb, dexie, elysia, prisma]
---

# Introduction

This specification documents the sync module for BearUang, a multi-tenant inventory and point-of-sale (POS) management system. The sync module provides three backend API endpoints for initial data loading, incremental delta synchronization, and batch processing of offline mutations. It works in conjunction with the frontend offline-first pipeline built on Dexie (IndexedDB), a mutation queue with retry/conflict handling, and TanStack Query cache invalidation. This spec focuses on the backend sync API endpoints and how they interact with the offline-first architecture documented in the [Offline-First Specification](../offline-first/spec-v1.md).

## 1. Purpose & Scope

This specification defines:

- **Backend sync endpoints**: `GET /sync/initial`, `GET /sync/delta`, `POST /sync/batch` — their request/response schemas, serialization behavior, and processing logic
- **Syncable models**: The six models available for initial and delta sync (products, variants, product categories, customers, warehouses, suppliers)
- **Batch mutation processing**: The sequential processing of offline mutations for sales orders and customers, including conflict detection and audit logging
- **Frontend sync pipeline**: The initial sync flow, delta sync with background interval, mutation queue processing, and status pub/sub
- **Dexie IndexedDB schema**: Table definitions, indexed fields, versioned schema, and organization-scoped data isolation
- **Mutation queue**: Enqueue, retry with exponential backoff, conflict resolution, and queue lifecycle management
- **Serialization conventions**: Date-to-ISO-string and Decimal-to-number conversion for sync responses

**Audience**: Backend and frontend developers working on the sync subsystem and offline-first features.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, Dexie.js, TanStack Query, and the BearUang offline-first architecture.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Initial Sync** | Fetching all records for a model (up to 10,000 per model) from the server, replacing the entire local dataset in IndexedDB |
| **Delta Sync** | Fetching only records modified since the last successful sync, identified by `updatedAt > since` timestamp |
| **Sync Timestamp** | An ISO 8601 timestamp returned by the server after each sync operation, stored in the `syncMeta` Dexie table as `lastSync:<model>` |
| **Mutation Queue** | An IndexedDB-backed outbox table that stores offline write operations (`pending`, `syncing`, `failed`, `conflict`) for deferred server sync |
| **Temp ID** | A client-generated identifier (`offline_<uuid>`) assigned to records created offline, replaced by the server-assigned ID upon successful sync |
| **Batch Mutation** | A single `POST /sync/batch` request containing 1–50 mutations, processed sequentially on the server |
| **Conflict** | A mutation that the server rejected during sync (e.g., stale state transition, not found); surfaced to the user via ConflictDialog |
| **Syncable Model** | One of the six models eligible for initial/delta sync: products, variants, categories, customers, warehouses, suppliers |
| **Sync Status** | A pub/sub state machine (`idle`, `syncing`, `syncing-mutations`, `error`) that drives the UI sync indicator |
| **Dexie** | TypeScript-friendly IndexedDB wrapper providing typed tables, indexed queries, and reactive hooks (`dexie-react-hooks`) |
| **bulkPut** | A Dexie operation that inserts or updates records by primary key; used to write sync results into IndexedDB tables |
| **clearOrgData** | A function that deletes all IndexedDB records (sync data, mutations, sales orders) scoped to a specific organization |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Sync Endpoints

- **REQ-001**: The sync module resides in `packages/backend/src/modules/sync/sync.route.ts`
- **REQ-002**: The sync route plugin is an Elysia instance with `{ prefix: '/sync', tags: ['Sync'] }`
- **REQ-003**: The sync route plugin must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every sync endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Sync endpoints do not use `requirePermission` — any authenticated org member can sync
- **REQ-006**: `GET /sync/initial` fetches all records for requested models (defaults to all 6), scoped by `organizationId`
- **REQ-007**: `GET /sync/delta` fetches records where `updatedAt > since` for requested models, scoped by `organizationId`
- **REQ-008**: `POST /sync/batch` processes 1–50 mutations sequentially, returning per-mutation results
- **REQ-009**: All Date fields in sync responses must be serialized to ISO 8601 strings via `serializeDate()`
- **REQ-010**: All Decimal fields in sync responses must be serialized to numbers via `serializeDecimal()` (`.toNumber()`)
- **REQ-011**: Soft-deleted records (non-null `deletedAt`) are included in sync responses
- **REQ-012**: Each model query is capped at `MAX_RECORDS_PER_MODEL` (10,000 records)
- **REQ-013**: All model data queries are scoped by `organizationId` for multi-tenant isolation
- **REQ-014**: Each model fetch in initial/delta sync is wrapped in try/catch — a failure for one model returns an empty array without failing the entire request
- **REQ-015**: The `models` query parameter accepts a comma-separated string or string array; invalid model names are silently filtered out via `parseModels()`

### 3.2 Batch Mutation Processing

- **REQ-016**: Mutations are processed sequentially in a `for...of` loop — each mutation completes (success or failure) before the next begins
- **REQ-017**: An exception thrown by a single mutation is caught and converted to a `failed` result without aborting the batch
- **REQ-018**: Supported mutation models: `sales-orders` (create and update) and `customers` (create only)
- **REQ-019**: Unknown models return `{ status: 'failed', error: 'Unknown model: <model>' }`
- **REQ-020**: Unsupported operations return `{ status: 'failed', error: 'Unsupported operation: <op> for <model>' }`
- **REQ-021**: Successful sales order creation delegates to `salesOrdersService.createSalesOrder()` and returns the server-generated ID
- **REQ-022**: Sales order update delegates to `salesOrdersService.updateSalesOrder()`. If the service returns `{ error: 'not_found' }`, the batch result is `{ status: 'failed' }`. For other errors, the result is `{ status: 'conflict', conflictData: { currentState } }`
- **REQ-023**: Customer creation delegates to `prisma.customer.create()` directly with the organization ID injected
- **REQ-024**: All successful mutations are audit-logged via `void logAudit(...)` with `offlineSync: true` and the `tempId` in args
- **REQ-025**: The batch response body schema is validated: each result has `tempId`, optional `serverId`, `status` (success/conflict/failed), optional `conflictData`, optional `error`

### 3.3 Frontend Sync Pipeline

- **REQ-026**: The frontend sync library resides in `packages/frontend/src/lib/sync.ts`
- **REQ-027**: `syncAllModels()` calls `syncInitial()` with all 6 models, writing results to IndexedDB via `bulkPut()`
- **REQ-028**: `syncDelta()` fetches per-model timestamps from `syncMeta`, then requests delta changes from `GET /sync/delta` in batches of 3 concurrent requests
- **REQ-029**: After writing delta records to IndexedDB, `setLastSync(model, syncTimestamp)` updates the sync meta for each model
- **REQ-030**: `startBackgroundSync(intervalMs)` runs `syncDelta()` + `processMutationQueue()` immediately, then on an interval (default 5 minutes)
- **REQ-031**: `stopBackgroundSync()` clears the interval timer
- **REQ-032**: Both `syncDelta()` and `processMutationQueue()` short-circuit if `navigator.onLine` is `false`
- **REQ-033**: Sync status is broadcast via a `Set<Listener>` pub/sub mechanism with `subscribeSyncStatus()` and `getSyncStatus()`
- **REQ-034**: `useSyncInit()` hook triggers initial sync on mount, clears previous org data on org switch, and starts background sync

### 3.4 Mutation Queue

- **REQ-035**: The mutation queue library resides in `packages/frontend/src/lib/mutation-queue.ts`
- **REQ-036**: `enqueueMutation()` creates a queue item with `status: 'pending'`, `retries: 0`, and a generated `tempId`
- **REQ-037**: `generateTempId()` produces IDs in the format `offline_<crypto.randomUUID()>`
- **REQ-038**: `processSyncResults()` maps server results to queue actions: `success` -> `markMutationSynced` (delete), `conflict` -> `markMutationConflict`, `failed` -> `markMutationFailed`
- **REQ-039**: `markMutationFailed()` increments retries. If retries >= `MAX_RETRIES` (5), status becomes `failed`; otherwise status resets to `pending`
- **REQ-040**: Exponential backoff delay is calculated as `BASE_RETRY_DELAY_MS * 2^retries` (1s, 2s, 4s, 8s, 16s)
- **REQ-041**: `retryMutation()` resets a failed/conflict mutation back to `pending` with `error: null`
- **REQ-042**: `discardMutation()` deletes the mutation from the queue
- **REQ-043**: `getQueueStats()` returns counts for `pending`, `syncing`, `failed`, and `conflict` statuses
- **REQ-044**: `processMutationQueue()` marks pending items as `syncing` via `bulkUpdate`, sends to `POST /sync/batch`, then processes results. On network error, syncing items are reverted to `pending`

### 3.5 Dexie IndexedDB Schema

- **REQ-045**: The database class is `BearUangDB`, extending `Dexie`, instantiated as a singleton exported from `packages/frontend/src/lib/db.ts`
- **REQ-046**: The database name is `'bearuang-offline'`
- **REQ-047**: Version 1 defines all 9 tables with their indexed fields
- **REQ-048**: Version 2 adds `tempId` and `retries` indexes to the `mutationQueue` table
- **REQ-049**: `clearOrgData(organizationId)` deletes all records from syncable tables, sync meta, pending mutations, and sales orders for the given organization
- **REQ-050**: `getLastSync(model)` and `setLastSync(model, timestamp)` read/write the `syncMeta` table with key format `lastSync:<model>`

### 3.6 Frontend Hooks

- **REQ-051**: `useSyncInit()` monitors `activeOrganizationId` from the session, triggers initial sync on first load, clears data on org switch, and manages background sync lifecycle
- **REQ-052**: `useOfflineData(model, queryFn, options)` provides a cache-before-network pattern: serves IndexedDB data immediately, fetches from API when online, and updates IndexedDB on success
- **REQ-053**: `useOfflineMutation(options)` provides an online-first-with-offline-fallback pattern: tries the API when online (falls back to queue on network error), enqueues directly when offline
- **REQ-054**: `useOfflineMutation` polls `getQueueStats()` every 5 seconds to track pending mutation count

### 3.7 Constraints

- **CON-001**: Sync endpoints do not enforce fine-grained permissions — any authenticated member of the organization can sync all models
- **CON-002**: Batch mutations are limited to 1–50 items per request; the server validates this via Zod `.min(1).max(50)`
- **CON-003**: Delta sync uses `Promise.allSettled` with batch size 3 to avoid overwhelming the server with concurrent requests
- **CON-004**: Initial sync does not filter by `deletedAt` — soft-deleted records are included so the client knows what was deleted
- **CON-005**: The `models` query parameter on `GET /sync/initial` is always set to all 6 models server-side regardless of the client's input value
- **CON-006**: `customers` and `warehouses`/`suppliers` models use `withSerializedDates` (no `deletedAt` field), while `products`, `variants`, and `categories` use `withSerializedSoftDelete` (include `deletedAt`)
- **CON-007**: The `processMutationQueue` uses an `isProcessingMutations` guard flag to prevent concurrent queue processing
- **CON-008**: `useOfflineData` is not yet adopted by dashboard pages (products, customers still use standard TanStack Query hooks)
- **CON-009**: Conflict resolution is retry-or-discard only; there is no merge UI showing server vs. client state

### 3.8 Guidelines

- **GUD-001**: When adding a new syncable model, update `SYNC_MODELS` (backend), `SYNCABLE_TABLES` (frontend db), `MODEL_TO_TABLE` (frontend sync), the Dexie schema version, and implement `fetchModelData`/`fetchModelDelta` cases
- **GUD-002**: Use `useOfflineMutation` for any new write operation that should work offline
- **GUD-003**: All offline-created records must be identifiable via audit log (`offlineSync: true`) and `tempId`
- **GUD-004**: When the server adds new fields to a syncable model, ensure the Dexie `bulkPut` schema is compatible (Dexie upgrades require explicit schema version bumps)
- **GUD-005**: Batch mutation results should be processed immediately after the API response to maintain consistency between IndexedDB and the server

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| GET | `/sync/initial` | Fetch all records for requested models (full data dump) | `requireAuth`, `requireOrg` | `{ models: Record<string, unknown[]>, syncTimestamp: string }` |
| GET | `/sync/delta` | Fetch records updated since timestamp (incremental) | `requireAuth`, `requireOrg` | `{ models: Record<string, unknown[]>, syncTimestamp: string }` |
| POST | `/sync/batch` | Process a batch of offline mutations (1–50) | `requireAuth`, `requireOrg` | `{ results: BatchResult[] }` |

### 4.2 Query Parameters

#### `GET /sync/initial`

```typescript
interface InitialSyncQuery {
  models?: string | string[];  // Comma-separated model names; defaults to all 6
  // Server-side always uses all models regardless of input:
  // 'products,variants,categories,customers,warehouses,suppliers'
}
```

#### `GET /sync/delta`

```typescript
interface DeltaSyncQuery {
  since: string;               // ISO 8601 timestamp (required)
  models?: string | string[];  // Comma-separated model names; defaults to all 6
}
```

### 4.3 Request Body

#### `POST /sync/batch`

```typescript
interface BatchRequestBody {
  mutations: Array<{
    tempId: string;                                    // Client-generated offline ID
    model: string;                                     // 'sales-orders' or 'customers'
    operation: 'create' | 'update' | 'delete';         // Operation type
    data: Record<string, unknown>;                     // Mutation payload (matches API body shape)
  }>;  // min: 1, max: 50
}
```

### 4.4 Response Shapes

#### Initial & Delta Sync Response

```typescript
interface SyncResponse {
  models: {
    products: ProductSyncRecord[];
    variants: VariantSyncRecord[];
    categories: ProductCategorySyncRecord[];
    customers: CustomerSyncRecord[];
    warehouses: WarehouseSyncRecord[];
    suppliers: SupplierSyncRecord[];
  };
  syncTimestamp: string;  // ISO 8601 — the server time when the response was generated
}
```

#### Batch Mutation Response

```typescript
interface BatchResponse {
  results: Array<{
    tempId: string;            // Matches the request tempId
    serverId?: string;         // Server-generated ID on success
    status: 'success' | 'conflict' | 'failed';
    conflictData?: unknown;    // Server state on conflict (e.g., { currentState: {...} })
    error?: string;            // Human-readable error message
  }>;
}
```

### 4.5 Sync Record Schemas

Each syncable model returns a flat record (no Prisma relations included) with serialized dates and decimals. The `select` clause controls which fields are returned.

#### Product Sync Record

```typescript
interface ProductSyncRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
  deletedAt: string | null;  // ISO 8601 or null (soft delete)
}
```

#### Variant Sync Record

```typescript
interface VariantSyncRecord {
  id: string;
  organizationId: string;
  productId: string;
  sku: string;
  name: string;
  price: number;          // Decimal serialized to number via .toNumber()
  stock: number;          // Integer
  unit: string;
  attributes: Record<string, unknown>;  // JSON object
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  deletedAt: string | null;
}
```

#### Product Category Sync Record

```typescript
interface ProductCategorySyncRecord {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  deletedAt: string | null;
}
```

#### Customer Sync Record

```typescript
interface CustomerSyncRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
```

#### Warehouse Sync Record

```typescript
interface WarehouseSyncRecord {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
```

#### Supplier Sync Record

```typescript
interface SupplierSyncRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
}
```

### 4.6 Syncable Models Mapping

| API Model Name | Backend Prisma Model | Dexie Table | Serialization | Has Soft Delete |
|----------------|---------------------|-------------|---------------|-----------------|
| `products` | `Product` | `products` | `withSerializedSoftDelete` | Yes (`deletedAt`) |
| `variants` | `ProductVariant` | `variants` | `withSerializedSoftDelete` + Decimal | Yes (`deletedAt`) |
| `categories` | `ProductCategory` | `productCategories` | `withSerializedSoftDelete` | Yes (`deletedAt`) |
| `customers` | `Customer` | `customers` | `withSerializedDates` | No |
| `warehouses` | `Warehouse` | `warehouses` | `withSerializedDates` | No |
| `suppliers` | `Supplier` | `suppliers` | `withSerializedDates` | No |

### 4.7 Batch Mutation Model Support

| Model | Operations | Backend Handler | Conflict Strategy |
|-------|-----------|-----------------|-------------------|
| `sales-orders` | `create` | `salesOrdersService.createSalesOrder()` | Accept all (new record, no conflict) |
| `sales-orders` | `update` | `salesOrdersService.updateSalesOrder()` | State machine validation; returns `conflict` if status transition is invalid, `failed` if not found |
| `customers` | `create` | `prisma.customer.create()` | Accept all (new record, no conflict) |
| Any other model | any | N/A | Returns `failed` with "Unknown model" |

### 4.8 Serialization Functions

```typescript
// Date serialization
function serializeDate(d: Date | null): string | null {
  return d?.toISOString() ?? null;
}

// Decimal serialization
function serializeDecimal(d: { toNumber: () => number }): number {
  return d.toNumber();
}

// Used by products, variants, categories (models with soft delete)
function withSerializedSoftDelete<T extends DateFields & SoftDeleteFields>(r: T) {
  return {
    ...r,
    createdAt: serializeDate(r.createdAt),
    updatedAt: serializeDate(r.updatedAt),
    deletedAt: serializeDate(r.deletedAt),
  };
}

// Used by customers, warehouses, suppliers (models without soft delete)
function withSerializedDates<T extends DateFields>(r: T) {
  return {
    ...r,
    createdAt: serializeDate(r.createdAt),
    updatedAt: serializeDate(r.updatedAt),
  };
}
```

### 4.9 Dexie IndexedDB Schema

```typescript
class BearUangDB extends Dexie {
  syncMeta!: Dexie.Table<SyncMetaItem, string>;
  products!: Dexie.Table<ProductRecord, string>;
  variants!: Dexie.Table<VariantRecord, string>;
  productCategories!: Dexie.Table<ProductCategoryRecord, string>;
  customers!: Dexie.Table<CustomerRecord, string>;
  warehouses!: Dexie.Table<WarehouseRecord, string>;
  suppliers!: Dexie.Table<SupplierRecord, string>;
  mutationQueue!: Dexie.Table<MutationQueueItem, number>;
  salesOrders!: Dexie.Table<SalesOrderRecord, string>;
  stockSnapshot!: Dexie.Table<StockSnapshotRecord, string>;

  constructor() {
    super('bearuang-offline');

    // Version 1: Initial schema
    this.version(1).stores({
      syncMeta: 'key,value',
      products: 'id,organizationId,name,slug,categoryId,updatedAt',
      variants: 'id,organizationId,productId,sku,name,stock,updatedAt',
      productCategories: 'id,organizationId,parentId,slug,updatedAt',
      customers: 'id,organizationId,name,email,updatedAt',
      warehouses: 'id,organizationId,name,updatedAt',
      suppliers: 'id,organizationId,name,updatedAt',
      mutationQueue: '++id,createdAt,status,model,operation',
      salesOrders: 'id,organizationId,status,createdAt,updatedAt',
      stockSnapshot: 'variantId,warehouseId,stock,updatedAt',
    });

    // Version 2: Added tempId and retries indexes to mutationQueue
    this.version(2).stores({
      mutationQueue: '++id,tempId,createdAt,syncedAt,status,model,operation,retries',
    });
  }
}
```

### 4.10 Mutation Queue Item Schema

```typescript
interface MutationQueueItem {
  id?: number;             // Auto-incremented Dexie primary key
  tempId: string;          // Client-generated: 'offline_<uuid>'
  createdAt: string;       // ISO timestamp of enqueue time
  syncedAt: string | null; // ISO timestamp of successful sync (then deleted)
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  model: string;           // 'sales-orders' or 'customers'
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;  // The mutation payload
  error: string | null;    // Serialized error message on failure/conflict
  retries: number;         // Current retry count (max 5)
  dependsOn: number | null; // Future: dependency on another mutation's queue ID
}
```

### 4.11 Sync Status State Machine

```
idle ──► syncing ──► idle
  │                    │
  │              syncing-mutations ──► idle
  │
  └──► error ──► idle (on next sync cycle)
```

| State | Meaning | Trigger |
|-------|---------|---------|
| `idle` | No sync activity | Initial state; after successful sync |
| `syncing` | Fetching data from server | `syncInitial()` or `syncDelta()` called |
| `syncing-mutations` | Processing offline mutation queue | `processMutationQueue()` called |
| `error` | Last sync operation failed | Exception in sync/delta/mutation processing |

### 4.12 Mutation Queue Status Transitions

```
                    enqueueMutation()
                          │
                          ▼
                      ┌─────────┐
                      │ pending │◄──────── retryMutation()
                      └────┬────┘
                           │ processMutationQueue()
                           ▼
                     ┌──────────┐
                     │ syncing  │
                     └────┬─────┘
               success │         │ failed
                       ▼         ▼
              (deleted)    retries < 5?
                              │
                     ┌────────┴────────┐
                     │ Yes             │ No (>= 5)
                     ▼                 ▼
                 ┌─────────┐      ┌─────────┐
                 │ pending │      │ failed  │──► retryMutation()
                 │ +retry  │      └─────────┘
                 └─────────┘
                                         
            conflict │
                      ▼
               ┌───────────┐
               │ conflict  │──► retryMutation() → pending
               └───────────┘    discardMutation() → deleted
```

### 4.13 Frontend File Structure

```
packages/frontend/src/
  lib/
    db.ts                    # Dexie database class, schema, clearOrgData, sync meta helpers
    sync.ts                  # syncAllModels, syncInitial, syncDelta, processMutationQueue,
                             # startBackgroundSync, stopBackgroundSync, sync status pub/sub
    mutation-queue.ts        # enqueueMutation, processSyncResults, retryMutation,
                             # discardMutation, getQueueStats, generateTempId, buildBatchPayload
  hooks/
    use-sync-init.ts         # Triggers initial sync on mount, org switch cleanup, background sync
    use-offline-data.ts      # Generic cache-before-network hook for syncable model reads
    use-offline-mutation.ts  # Online-first-with-offline-fallback hook for write operations
```

### 4.14 Backend File Structure

```
packages/backend/src/modules/sync/
  sync.route.ts              # Elysia route plugin with 3 endpoints, serialization helpers,
                             # fetchModelData, fetchModelDelta, processBatchMutation, parseModels
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user, When `GET /sync/initial` is called, Then the response contains all records for the 6 syncable models scoped to the user's organization, with Date fields as ISO 8601 strings and Decimal fields as numbers
- **AC-002**: Given an authenticated user, When `GET /sync/initial?models=products,variants` is called, Then only the requested models are returned in the response
- **AC-003**: Given an authenticated user, When `GET /sync/delta?since=2026-04-04T00:00:00.000Z` is called, Then only records with `updatedAt` greater than the `since` timestamp are returned
- **AC-004**: Given an authenticated user, When `GET /sync/delta?since=invalid-date` is called, Then the response returns `{ error: 'Invalid since timestamp' }`
- **AC-005**: Given an authenticated user with queued offline mutations, When `POST /sync/batch` is called with 1–50 mutations, Then each mutation is processed sequentially and a per-mutation result is returned with `tempId`, `status`, and optionally `serverId` or `error`
- **AC-006**: Given a `POST /sync/batch` request with more than 50 mutations, Then Zod validation rejects the request with a 422 error
- **AC-007**: Given a `POST /sync/batch` request with a `sales-orders` create mutation, When the sales order service returns a successful result, Then the batch result has `{ status: 'success', serverId: '<uuid>' }` and an audit log entry is created with `offlineSync: true`
- **AC-008**: Given a `POST /sync/batch` request with a `sales-orders` update mutation for a non-existent order, When the service returns `{ error: 'not_found' }`, Then the batch result has `{ status: 'failed', error: 'Sales order not found' }`
- **AC-009**: Given a `POST /sync/batch` request with an invalid status transition, When the service returns an error, Then the batch result has `{ status: 'conflict', conflictData: { currentState } }`
- **AC-010**: Given a `POST /sync/batch` request with an unknown model, Then the batch result has `{ status: 'failed', error: 'Unknown model: <model>' }`
- **AC-011**: Given an unauthenticated request to any sync endpoint, Then a `401 Unauthorized` is returned
- **AC-012**: Given the frontend initial sync completes, Then all 6 Dexie tables are populated with `bulkPut()` and `syncMeta` entries are set with the server's `syncTimestamp`
- **AC-013**: Given a user switches organizations, Then `clearOrgData()` deletes all previous org's data from IndexedDB and a fresh initial sync is triggered
- **AC-014**: Given queued mutations exist and the network reconnects, Then `processMutationQueue()` sends mutations to the server and processes results — successful mutations are deleted, conflicts are marked, and failed mutations increment retry count
- **AC-015**: Given a mutation fails 5 times, Then its status becomes `failed` and it is no longer retried automatically
- **AC-016**: Given the app is online, When 5 minutes elapse, Then `syncDelta()` runs automatically via the background interval without blocking the UI
- **AC-017**: Given soft-deleted products exist in the database, When initial or delta sync runs, Then those records are included in the response with a non-null `deletedAt` field

## 6. Test Automation Strategy

### 6.1 Test Levels

| Level | Scope | Priority |
|-------|-------|----------|
| Unit | `mutation-queue.ts` (enqueue, retry, status transitions, generateTempId, buildBatchPayload, processSyncResults) | High |
| Unit | `db.ts` (Dexie schema, clearOrgData, sync meta CRUD) | High |
| Unit | `sync.ts` (sync status pub/sub, syncInitial, syncDelta, startBackgroundSync/stopBackgroundSync) | High |
| Unit | `use-offline-data.ts`, `use-offline-mutation.ts`, `use-sync-init.ts` (hook behavior with mocked Dexie/TanStack Query) | High |
| Integration | `POST /sync/batch` endpoint (mutation processing, conflict detection, audit logging, model routing) | High |
| Integration | `GET /sync/initial` and `GET /sync/delta` (data shape, serialization, pagination cap, soft-delete inclusion) | Medium |
| E2E | Full offline transaction flow (create order offline, reconnect, verify sync, verify IndexedDB cleanup) | Medium |

### 6.2 Frameworks

- **Frontend unit/integration**: Vitest + `fake-indexeddb` for Dexie testing
- **Backend integration**: Bun's built-in test API (`bun:test`) + Elysia test client (`app.handle(new Request(...))`)
- **E2E**: Playwright (Service Worker support via `context.serviceWorkers()`)

### 6.3 Test Data Management

- Use Dexie's in-memory mode or `fake-indexeddb` for frontend unit tests (no browser required)
- Backend tests use existing Prisma test database with seed data
- Each test should create and clean up its own organization context
- Batch mutation tests should verify audit log entries with `offlineSync: true`

### 6.4 Coverage Requirements

- Minimum 80% line coverage for `db.ts`, `mutation-queue.ts`, `sync.ts`
- Minimum 80% line coverage for `sync.route.ts` (all 3 endpoints, all 6 model cases, batch mutation processing)

### 6.5 CI/CD Integration

- Sync module tests must run in CI as part of the existing `bun run check` workflow
- E2E sync tests should be gated behind a separate job (requires browser environment for IndexedDB)

## 7. Rationale & Context

### Why Three Separate Sync Endpoints?

Initial sync and delta sync serve fundamentally different purposes. Initial sync replaces all local data (used on first load, org switch, or full refresh), while delta sync incrementally updates only changed records (used for periodic background refresh). Separating batch mutations into a dedicated endpoint keeps read-sync and write-sync concerns isolated, allowing independent rate limiting, error handling, and caching strategies.

### Why Sequential Mutation Processing?

Mutations within a batch are processed sequentially (`for...of` loop) rather than in parallel to preserve ordering and avoid race conditions. For example, a sales order creation followed by a status update must be processed in that order. A single mutation failure does not abort the batch — each mutation is independently try/caught to maximize throughput.

### Why Include Soft-Deleted Records in Sync?

Soft-deleted records (non-null `deletedAt`) are included in initial and delta sync responses so the client can maintain a complete dataset. Without this, a product deleted on the server while the client was offline would persist in the local IndexedDB indefinitely. The client can use the `deletedAt` field to filter out deleted records in UI queries.

### Why 10,000 Record Cap Per Model?

The `MAX_RECORDS_PER_MODEL` (10,000) cap prevents unbounded memory usage and response sizes for organizations with large datasets. If an organization exceeds this limit, the oldest records (by `updatedAt`) are excluded. This is a pragmatic trade-off — the current target customers (small-to-medium Indonesian retail businesses) are unlikely to approach this limit per model.

### Why No Fine-Grained Permissions on Sync Endpoints?

Sync endpoints are designed to serve the offline-first POS use case where any authenticated cashier needs access to the full product catalog and customer list. Permission-gated filtering would complicate the sync pipeline and potentially leave the local database in an inconsistent state (e.g., a product visible via relation but not synced). Organization membership is the access boundary.

### Why Exponential Backoff with 5 Retries?

The retry strategy (1s, 2s, 4s, 8s, 16s delays; max 5 retries) balances responsiveness with load reduction during extended outages. After 5 retries, the mutation is marked as `failed` and surfaced to the user via the ConflictDialog for manual intervention. This prevents indefinite silent retries that could waste bandwidth and battery on mobile devices.

### Why Dexie bulkPut Instead of Individual Puts?

`bulkPut` writes all records in a single IndexedDB transaction, which is significantly faster than individual `put()` calls for large datasets. Dexie's `bulkPut` performs an upsert (insert or update) by primary key, which is ideal for sync — records that already exist are updated, and new records are inserted.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: **PostgreSQL** — Primary data store for all syncable models; queried via Prisma ORM with `updatedAt` delta filtering
- **EXT-002**: **IndexedDB** — Browser-native transactional database for offline data persistence; managed via Dexie.js

### Third-Party Services

- **SVC-001**: **better-auth** — Authentication and organization membership; provides `authPlugin` with `user`, `organization`, `_authType` context for sync endpoints
- **SVC-002**: **Dexie.js 4.x** — IndexedDB wrapper (`dexie`, `dexie-react-hooks`) for typed offline data storage

### Infrastructure Dependencies

- **INF-001**: **Bun runtime** (v1.3.10+) — Server runtime for sync API endpoints
- **INF-002**: **IndexedDB API** — Required for structured offline data storage in the browser
- **INF-003**: **Navigator.onLine / online/offline events** — Used for connectivity detection to gate sync operations and toggle UI state

### Data Dependencies

- **DAT-001**: **Sales Orders Module** — `salesOrdersService.createSalesOrder()` and `salesOrdersService.updateSalesOrder()` are the backend handlers for `sales-orders` batch mutations
- **DAT-002**: **Customer Model** — `prisma.customer.create()` is the backend handler for `customers` batch mutations (create only)
- **DAT-003**: **PostgreSQL `updatedAt` column** — All syncable models must have an `updatedAt` timestamp column (via Prisma `@updatedAt`) for delta sync filtering
- **DAT-004**: **Product, Variant, ProductCategory, Customer, Warehouse, Supplier models** — The six Prisma models that provide data for initial and delta sync

### Technology Platform Dependencies

- **PLT-001**: **Elysia.js** — Backend HTTP framework for sync API endpoints with Zod validation
- **PLT-002**: **Prisma ORM** — Database access layer with typed queries and `select` clauses for sync record shaping
- **PLT-003**: **React 19** — Frontend UI framework for sync hooks and offline components
- **PLT-004**: **TanStack Query** — Server-state cache layer; invalidated after successful mutation sync
- **PLT-005**: **Dexie.js** — IndexedDB wrapper for typed offline data storage and reactive queries
- **PLT-006**: **@elysiajs/eden** — Type-safe API client connecting the frontend sync library to the Elysia backend

### Compliance Dependencies

- **COM-001**: **Audit logging** — All successful batch mutations are logged with `offlineSync: true`, `tempId`, and the full mutation payload in audit args

## 9. Examples & Edge Cases

### 9.1 Initial Sync Flow

```
1. User logs in and selects Organization A
   → useSyncInit() detects orgId, calls syncAllModels()
   → syncAllModels() calls syncInitial(['products','variants','categories','customers','warehouses','suppliers'])

2. syncInitial sends GET /sync/initial?models=products,variants,categories,customers,warehouses,suppliers
   → Server fetches all records for each model (scoped by organizationId)
   → Response: { models: { products: [...500 records], variants: [...1200 records], ... }, syncTimestamp: "2026-04-04T12:00:00.000Z" }

3. Frontend writes each model's records to IndexedDB via bulkPut
   → db.products.bulkPut(productsRecords)
   → db.variants.bulkPut(variantsRecords)
   → ... (all 6 tables)

4. Frontend stores sync timestamps
   → db.syncMeta.put({ key: 'lastSync:products', value: '2026-04-04T12:00:00.000Z' })
   → ... (all 6 models)

5. startBackgroundSync() begins 5-minute interval
   → syncDelta runs immediately
   → setInterval triggers syncDelta + processMutationQueue every 5 minutes
```

### 9.2 Delta Sync Flow

```
1. 5-minute background interval fires
   → navigator.onLine is true
   → syncDelta(['products','variants','categories','customers','warehouses','suppliers'])

2. For each model, read lastSync timestamp from syncMeta
   → getLastSync('products') → '2026-04-04T12:00:00.000Z'
   → getLastSync('variants') → '2026-04-04T12:00:00.000Z'
   → ...

3. Process models in batches of 3 concurrent requests (Promise.allSettled)
   → Batch 1: api.sync.delta.get({ query: { since: '...', models: 'products' } })
              api.sync.delta.get({ query: { since: '...', models: 'variants' } })
              api.sync.delta.get({ query: { since: '...', models: 'categories' } })

4. Server responds with only changed records
   → { models: { products: [2 updated, 1 deleted], variants: [5 updated], categories: [] }, syncTimestamp: '...' }

5. Frontend writes changed records to IndexedDB via bulkPut
   → Deleted records are written with their deletedAt timestamp
   → Updated records overwrite existing records by primary key

6. Update syncMeta timestamps with the new syncTimestamp
```

### 9.3 Offline Mutation Queue Flow

```
1. Cashier is offline, creates a sales order
   → useOfflineMutation detects navigator.onLine === false
   → generateTempId() → 'offline_550e8400-e29b-41d4-a716-446655440000'
   → enqueueMutation({ tempId, model: 'sales-orders', operation: 'create', data: {...} })
   → Mutation stored in IndexedDB with status: 'pending'
   → Returns { tempId: 'offline_550e...', offline: true }
   → Toast: "Transaksi disimpan offline. Akan disinkronkan otomatis."

2. Cashier also creates a new customer offline
   → enqueueMutation({ tempId: 'offline_...', model: 'customers', operation: 'create', data: {...} })

3. Network reconnects (online event fires)
   → Background sync interval triggers processMutationQueue()
   → getPendingCount() → 2
   → Mark both mutations as 'syncing' via bulkUpdate

4. Send POST /sync/batch with both mutations
   → Server processes sales-orders create → success, returns serverId
   → Server processes customers create → success, returns serverId
   → Response: { results: [{ tempId: '...', serverId: '...', status: 'success' }, ...] }

5. processSyncResults iterates:
   → success → markMutationSynced(id) → updates syncedAt, then deletes from queue
   → TanStack Query caches invalidated (if invalidateKeys provided)
```

### 9.4 Conflict Handling Flow

```
1. Offline mutation: sales-orders update with status 'SHIPPED' (stale client state)
2. Network reconnects, processMutationQueue sends to POST /sync/batch
3. Server: salesOrdersService.updateSalesOrder() rejects invalid status transition
4. Batch result: { tempId: '...', status: 'conflict', conflictData: { currentState: { status: 'CANCELLED' } } }
5. processSyncResults: markMutationConflict(id, conflictData)
6. Queue item status → 'conflict', error set to JSON stringified conflictData
7. SyncStatusBadge shows pending count
8. User clicks badge → ConflictDialog opens
9. User sees: "Sales Order - update - Cannot transition from CANCELLED to SHIPPED"
10. User clicks "Coba Lagi" (Retry) → retryMutation(id) resets to pending
    OR User clicks "Buang" (Discard) → discardMutation(id) deletes from queue
```

### 9.5 Organization Switch Flow

```
1. User is in Org A with 500 synced products
2. User switches to Org B
   → useSyncInit detects prevOrgId.current !== orgId
   → clearOrgData('org-a-id') called:
     - Deletes all products where organizationId = 'org-a-id'
     - Deletes all variants where organizationId = 'org-a-id'
     - ... (all 6 syncable tables)
     - Deletes all syncMeta entries (lastSync:products, etc.)
     - Deletes all pending/syncing mutations
     - Deletes all sales orders for Org A
   → isSynced.current = false
   → syncAllModels() triggers fresh initial sync for Org B
   → IndexedDB now contains only Org B data
```

### 9.6 Edge Cases

- **Multiple tabs**: Sync status is shared via the pub/sub listener pattern in `sync.ts`. Background sync runs in each tab but the `isProcessingMutations` guard prevents concurrent queue processing. Dexie transactions handle concurrent writes safely.
- **Rapid org switching**: `useSyncInit` uses `useRef` flags (`prevOrgId`, `isSynced`) to prevent double-syncing and ensures cleanup of the previous org's data before re-syncing. The effect cleanup calls `stopBackgroundSync()`.
- **Queue processing interruption**: If `processMutationQueue` fails mid-batch (network error), mutations with status `'syncing'` are reverted to `'pending'` with an error message. On the next sync cycle, they will be retried.
- **Batch size exceeded client-side**: `buildBatchPayload()` does not currently enforce the 50-mutation limit client-side. If exceeded, the server returns a Zod validation error (422), which triggers the error handler in `processMutationQueue` and reverts syncing items to pending.
- **Empty delta response**: When no records have changed since the `since` timestamp, all model arrays are empty. The frontend skips the `bulkPut` call (early return in `writeRecordsToTable` when `records.length === 0`) and still updates the sync timestamp.
- **Invalid `since` timestamp**: `GET /sync/delta?since=invalid` results in `isNaN(since.getTime())` being true, returning `{ error: 'Invalid since timestamp' }`. The frontend does not update sync meta in this case.
- **Concurrent initial and delta sync**: `processMutationQueue` uses the `isProcessingMutations` boolean guard to prevent concurrent queue processing. If `processMutationQueue` is already running, subsequent calls return `null` immediately.
- **Sales order update missing ID**: A `sales-orders` update mutation without an `id` field in `data` returns `{ status: 'failed', error: 'Missing id for update' }` without calling the service.
- **Customer email uniqueness**: If a customer is created offline with an email that already exists on the server, Prisma's unique constraint will throw. This is caught by the try/catch in the batch processing loop and returned as a `failed` result.
- **Variant price Decimal serialization**: The variant `price` field is a Prisma `Decimal` type (`@db.Decimal(12, 2)`). It is serialized via `serializeDecimal()` which calls `.toNumber()`, converting it to a JavaScript number for JSON-safe transport.

## 10. Validation Criteria

A sync module conforming to this specification must satisfy:

1. **Endpoint structure**: 3 endpoints under `/sync` prefix with `authPlugin`, `requireAuth`, and `requireOrg`
2. **Initial sync completeness**: `GET /sync/initial` returns all 6 models with correctly serialized Date/Decimal fields, including soft-deleted records
3. **Delta sync correctness**: `GET /sync/delta` returns only records with `updatedAt > since`, scoped by organization
4. **Batch processing**: `POST /sync/batch` processes 1–50 mutations sequentially with per-mutation results; individual failures do not abort the batch
5. **Audit logging**: All successful batch mutations are audit-logged with `offlineSync: true` and `tempId`
6. **Serialization consistency**: All Date fields are ISO 8601 strings; variant price is a number; JSON attributes are objects
7. **IndexedDB schema**: Dexie database `bearuang-offline` with version 1 and version 2 schema, including all 9 tables with correct indexed fields
8. **Organization isolation**: `clearOrgData()` removes all records for a specific organization across all tables
9. **Mutation queue lifecycle**: Enqueue → pending → syncing → success (delete) / conflict / failed (with retry up to 5)
10. **Background sync**: Delta sync and mutation queue processing run on a 5-minute interval when online
11. **Status pub/sub**: Sync status changes are broadcast to all subscribers reactively
12. **Hook integration**: `useSyncInit` triggers sync on mount and org switch; `useOfflineMutation` falls back to queue on network error
13. **Validation error handling**: Invalid batch size, invalid `since` timestamp, and unknown models return appropriate error responses

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- [Offline-First Specification](../offline-first/spec-v1.md) — Comprehensive offline-first architecture including Service Worker caching, IndexedDB patterns, conflict resolution UI, and POS-specific flows
- Backend sync route: `packages/backend/src/modules/sync/sync.route.ts`
- Frontend sync library: `packages/frontend/src/lib/sync.ts`
- Frontend mutation queue: `packages/frontend/src/lib/mutation-queue.ts`
- Frontend Dexie database: `packages/frontend/src/lib/db.ts`
- Frontend sync init hook: `packages/frontend/src/hooks/use-sync-init.ts`
- Frontend offline data hook: `packages/frontend/src/hooks/use-offline-data.ts`
- Frontend offline mutation hook: `packages/frontend/src/hooks/use-offline-mutation.ts`
- Sales orders service: `packages/backend/src/modules/sales-orders/sales-orders.service.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Prisma schema: `packages/backend/prisma/schema.prisma`
- Dexie.js Documentation: https://dexie.org/docs/
- Products, Variants & Categories Specification: `specs/products/spec-v1.md`
