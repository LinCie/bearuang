---
title: Offline-First Architecture for POS and Read Cache
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Platform Team
feature: offline-first
tags: [offline, pwa, dexie, workbox, sync, pos, indexeddb]
---

# Introduction

This specification defines the offline-first architecture for BearUang, a multi-tenant inventory and point-of-sale (POS) management system. The feature enables the POS to create sales orders while offline, provides instant product/variant lookups from IndexedDB, and ensures the app shell loads and renders even without network connectivity.

## 1. Purpose & Scope

### 1.1 Purpose

Enable retail store operations (POS transactions, product search) to continue uninterrupted during network outages. Provide structured local caching for reference data (products, variants, customers, warehouses) with automatic background synchronization.

### 1.2 Scope

- **In scope**: Service Worker app shell caching, IndexedDB read cache for 6 reference models, offline mutation queue for POS sales orders and customer creation, background sync pipeline, conflict resolution UI.
- **Out of scope**: Offline file uploads, offline auth flows, offline organization creation, offline API key management, offline member/role/permission management. Stock adjustments and purchase orders require online connectivity.
- **Audience**: Frontend and backend developers working on the BearUang platform.

### 1.3 Assumptions

- The user has previously authenticated and has an active session (cookies).
- The user has selected an organization (org context is required for all sync operations).
- IndexedDB is available in the user's browser (all modern browsers).
- The browser supports Service Workers (all modern browsers).

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Service Worker** | A background script that intercepts network requests and serves cached responses, enabling offline app shell loading. |
| **IndexedDB** | A browser-native transactional database for structured data storage. |
| **Dexie.js** | A TypeScript-friendly IndexedDB wrapper providing typed tables and reactive queries. |
| **Workbox** | A set of Google libraries for common Service Worker patterns (routing, caching, precaching). |
| **Mutation Queue** | An IndexedDB-backed outbox table that stores offline write operations for deferred server sync. |
| **Delta Sync** | Fetching only records modified since the last successful sync, identified by `updatedAt > lastSync`. |
| **Initial Sync** | Fetching all records for a model during first load or org switch, replacing the entire local dataset. |
| **Conflict** | A mutation that the server rejected during sync (e.g., stale data, validation failure). |
| **Temp ID** | A client-generated identifier (`offline_<uuid>`) assigned to records created offline, replaced by the server ID upon successful sync. |
| **TanStack Query** | The existing server-state cache layer used for data fetching, caching, and invalidation. |
| **Eden Treaty** | The type-safe API client (`@elysiajs/eden`) connecting the frontend to the Elysia backend. |

## 3. Requirements, Constraints & Guidelines

### 3.1 Functional Requirements

- **REQ-001**: The app shell (HTML, JS, CSS, fonts) must load and render offline with stale data.
- **REQ-002**: Product catalog, variants, customers, warehouses, suppliers, and product categories must be available instantly from IndexedDB without network requests.
- **REQ-003**: POS must create sales orders offline. Orders are stored locally with temp IDs and synced to the server upon reconnection.
- **REQ-004**: Customer creation at POS must work offline.
- **REQ-005**: Background sync must fetch server-side changes every 5 minutes while online and process any queued offline mutations.
- **REQ-006**: On reconnection, queued mutations must be processed immediately.
- **REQ-007**: Users must be able to retry or discard conflicting mutations via the ConflictDialog.
- **REQ-008**: The sync status (online, offline, syncing, pending mutations) must be visible in the dashboard top bar and POS page.
- **REQ-009**: On organization switch, all IndexedDB data for the previous organization must be cleared before re-syncing.
- **REQ-010**: Barcode scanning and product search at POS must work offline using IndexedDB data.

### 3.2 Non-Functional Requirements

- **NFR-001**: IndexedDB data per organization must stay under ~4MB estimated total.
- **NFR-002**: The service worker must not cache auth endpoints (`/api/auth/*`).
- **NFR-003**: The mutation queue must implement exponential backoff (1s, 2s, 4s, 8s, 16s) with a maximum of 5 retries before permanent failure.
- **NFR-004**: Sync operations must not block the UI thread.
- **NFR-005**: The batch mutation endpoint must process 1-50 mutations per request.
- **NFR-006**: Individual batch mutation failures must not prevent other mutations in the same batch from being processed.
- **NFR-007**: Image URLs must be stored in IndexedDB, not binary blobs. Images are served from S3 via Service Worker cache.

### 3.3 Security Requirements

- **SEC-001**: IndexedDB must not store API keys, session tokens, or full user credentials.
- **SEC-002**: Session tokens must remain in memory/cookies only (handled by existing auth system).
- **SEC-003**: A "clear offline data" operation must be available (triggered on org switch and logout via `clearOrgData`).

### 3.4 Constraints

- **CON-001**: `vite-plugin-pwa` with `injectManifest` strategy is used for service worker generation (deviates from the original plan which proposed a post-build Bun script; this was changed because `vite-plugin-pwa` works with the current Vite 7 setup).
- **CON-002**: Offline mutations are currently limited to `sales-orders` (create/update) and `customers` (create) in the backend batch endpoint.
- **CON-003**: `useOfflineData` generic hook exists but is not yet adopted by dashboard pages (products, customers, etc. still use standard TanStack Query hooks).
- **CON-004**: Conflict resolution is retry-or-discard only; there is no merge UI showing server vs. client state.
- **CON-005**: No test coverage exists for offline-first code (db, sync, mutation-queue, hooks).
- **CON-006**: Stock movements and adjustments require online connectivity (deferred from the plan's Phase 3 scope).

### 3.5 Guidelines

- **GUD-001**: Use `useOfflineMutation` for any new write operation that should work offline.
- **GUD-002**: Use `useOfflineVariants` for POS product search instead of standard API queries.
- **GUD-003**: When adding a new syncable model, update `SYNCABLE_TABLES`, the Dexie schema version, `syncAllModels`, and the backend `fetchModelData`/`fetchModelDelta` functions.
- **GUD-004**: All offline-created records must carry an `offline_created` flag or be identifiable via audit log (`offlineSync: true`).

## 4. Interfaces & Data Contracts

### 4.1 Dexie Database Schema

```typescript
const db = new BearUangDB('bearuang-offline');

// Version 1 (current):
db.version(1).stores({
  syncMeta: 'key,value',
  products: 'id,organizationId,name,slug,categoryId,updatedAt',
  variants: 'id,organizationId,productId,sku,name,stock,updatedAt',
  productCategories: 'id,organizationId,parentId,slug,updatedAt',
  customers: 'id,organizationId,name,email,updatedAt',
  warehouses: 'id,organizationId,name,updatedAt',
  suppliers: 'id,organizationId,name,updatedAt',
});

// Version 2 (added mutation queue + transactional data):
db.version(2).stores({
  // ...all v1 tables...
  mutationQueue: '++id,tempId,createdAt,syncedAt,status,model,operation,retries',
  salesOrders: 'id,organizationId,status,createdAt,updatedAt',
  stockSnapshot: 'variantId,warehouseId,stock,updatedAt',
});
```

### 4.2 Syncable Models

| Model Name (API) | Dexie Table | Description |
|-------------------|-------------|-------------|
| `products` | `products` | Product catalog with images |
| `variants` | `variants` | Product variants with SKU and stock |
| `categories` | `productCategories` | Hierarchical product categories |
| `customers` | `customers` | Customer contact records |
| `warehouses` | `warehouses` | Warehouse locations |
| `suppliers` | `suppliers` | Supplier contact records |

### 4.3 Mutation Queue Item

```typescript
interface MutationQueueItem {
  id?: number;           // Auto-incremented Dexie primary key
  tempId: string;        // Client-generated: 'offline_<uuid>'
  model: string;         // e.g., 'sales-orders', 'customers'
  operation: 'create' | 'update' | 'delete';
  data: unknown;         // The mutation payload (matches API body shape)
  createdAt: string;     // ISO timestamp
  syncedAt: string | null;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error?: string;        // Serialized error message on failure
  retries: number;       // Current retry count
}
```

### 4.4 Backend Sync API

#### `GET /sync/initial`

- **Auth**: Required (`requireAuth`, `requireOrg`)
- **Query params**: `models` (comma-separated, optional, defaults to all 6)
- **Response**:
  ```json
  {
    "models": {
      "products": [...],
      "variants": [...],
      "categories": [...],
      "customers": [...],
      "warehouses": [...],
      "suppliers": [...]
    },
    "syncTimestamp": "2026-04-04T12:00:00.000Z"
  }
  ```
- **Constraints**: Max 10,000 records per model. Dates serialized to ISO strings. Decimals serialized to strings. Soft-deleted records included with `deletedAt` field.

#### `GET /sync/delta`

- **Auth**: Required (`requireAuth`, `requireOrg`)
- **Query params**: `since` (ISO timestamp, required), `models` (comma-separated, optional)
- **Response**: Same shape as `/sync/initial`, but only records where `updatedAt > since`.

#### `POST /sync/batch`

- **Auth**: Required (`requireAuth`, `requireOrg`)
- **Body**:
  ```json
  {
    "mutations": [
      {
        "tempId": "offline_abc123",
        "model": "sales-orders",
        "operation": "create",
        "data": { ... sales order fields ... }
      }
    ]
  }
  ```
- **Constraints**: 1-50 mutations per request. Processed sequentially; one failure does not abort the batch.
- **Supported models**: `sales-orders` (create/update), `customers` (create).
- **Response**:
  ```json
  {
    "results": [
      {
        "tempId": "offline_abc123",
        "serverId": "real-uuid-456",
        "status": "success"
      },
      {
        "tempId": "offline_def456",
        "status": "conflict",
        "conflictData": { "message": "Sales order not found" }
      }
    ]
  }
  ```
- **Audit logging**: All processed mutations are logged with `offlineSync: true`.

### 4.5 Service Worker Caching Strategy

| Request Type | Strategy | Cache Name | Timeout | Max Entries | Max Age |
|-------------|----------|-----------|---------|-------------|---------|
| Navigation (HTML) | NetworkFirst | `pages` | 3s | - | - |
| `/api/auth/*` | NetworkOnly | - | - | - | - |
| `/api/*` (non-auth) | NetworkFirst | `api-cache` | 3s | 100 | 1 hour |
| Static assets (JS/CSS/fonts) | CacheFirst | `workbox-precache-v2` | - | - | - |
| Images (all origins) | CacheFirst | `images` | - | 60 | 30 days |

### 4.6 Conflict Resolution Strategy (Server-Side)

| Model | Operation | Strategy | Rationale |
|-------|-----------|----------|-----------|
| `sales-orders` | create | Accept all | New records cannot conflict |
| `sales-orders` | update | State machine validation | Server enforces `STATUS_TRANSITIONS`. If offline client has stale state, return conflict with current server state |
| `customers` | create | Accept all | New records cannot conflict |
| Unknown model | any | Reject | Return `failed` status with error message |

### 4.7 Sync Status State Machine

```
idle ──► syncing ──► idle
  │                    │
  │              syncing-mutations ──► idle
  │
  └──► error ──► idle (on next sync cycle)
```

| State | Meaning |
|-------|---------|
| `idle` | No sync activity |
| `syncing` | Fetching delta data from server |
| `syncing-mutations` | Processing offline mutation queue |
| `error` | Last sync operation failed |

## 5. Acceptance Criteria

- **AC-001**: Given a user with an active session, When the network is disconnected, Then the app shell (HTML/JS/CSS) loads from Service Worker cache and renders the dashboard layout.
- **AC-002**: Given a user has synced at least once, When the network is disconnected and they navigate to POS, Then product search and barcode scanning return results from IndexedDB.
- **AC-003**: Given a cashier is offline, When they complete a POS transaction (add items, payment), Then the sales order is saved to IndexedDB with a temp ID, a success toast is shown ("Transaksi disimpan offline..."), and the SyncStatusBadge shows pending count.
- **AC-004**: Given queued offline mutations exist, When the network reconnects, Then mutations are sent to `POST /sync/batch`, temp IDs are replaced with server IDs, and TanStack Query caches are invalidated.
- **AC-005**: Given a mutation fails during sync, When the retry count exceeds 5, Then the mutation status becomes `failed` and is visible in the ConflictDialog for manual retry or discard.
- **AC-006**: Given a user switches organizations, When the new org loads, Then all IndexedDB data for the previous org is cleared and a fresh initial sync is performed.
- **AC-007**: Given the app is online, When 5 minutes elapse, Then a delta sync runs automatically in the background without blocking the UI.
- **AC-008**: Given the OfflineIndicator is rendered in the dashboard layout, When the browser connectivity changes, Then the indicator updates within 1 second to reflect the new state (online/offline/syncing/pending).
- **AC-009**: Given a conflict exists in the mutation queue, When the user clicks the SyncStatusBadge in POS, Then the ConflictDialog opens showing the conflict details with Retry and Discard actions.

## 6. Test Automation Strategy

### 6.1 Test Levels

| Level | Scope | Priority |
|-------|-------|----------|
| Unit | `db.ts` (Dexie schema, `clearOrgData`, sync meta), `mutation-queue.ts` (enqueue, retry, status transitions), `sync.ts` (sync status pub/sub) | High |
| Unit | `use-offline-data.ts`, `use-offline-mutation.ts`, `use-sync-init.ts` (hook behavior with mocked Dexie/TanStack Query) | High |
| Integration | `POST /sync/batch` endpoint (mutation processing, conflict detection, audit logging) | High |
| Integration | `GET /sync/initial` and `GET /sync/delta` (data shape, serialization, pagination) | Medium |
| E2E | POS offline transaction flow (create order offline, reconnect, verify sync) | Medium |

### 6.2 Frameworks

- **Frontend unit/integration**: Vitest + `fake-indexeddb` for Dexie testing
- **Backend integration**: Bun's built-in test API (`bun:test`) + Elysia test client
- **E2E**: Playwright (Service Worker support via `context.serviceWorkers()`)

### 6.3 Test Data Management

- Use Dexie's in-memory mode or `fake-indexeddb` for frontend unit tests (no browser required).
- Backend tests use existing Prisma test database with seed data.
- Each test should create and clean up its own organization context.

### 6.4 Coverage Requirements

- Minimum 80% line coverage for `db.ts`, `mutation-queue.ts`, `sync.ts`.
- Minimum 80% line coverage for `sync.route.ts` backend handler.

### 6.5 CI/CD Integration

- Offline-first tests must run in CI as part of the existing `bun run check` workflow.
- Service Worker tests should be gated behind a separate job (requires browser environment).

## 7. Rationale & Context

### 7.1 Why Dexie.js + Workbox (not TanStack DB/PowerSync/WatermelonDB/RxDB)

- **Migration complexity**: Dexie works alongside existing TanStack Query without requiring a data layer rewrite.
- **TanStack Query compatibility**: Dexie complements TanStack Query (cache-before-network pattern) rather than replacing it.
- **Bundle size**: Dexie is ~15KB gzipped vs. heavier alternatives.
- **Maturity**: Dexie is battle-tested (12K+ GitHub stars), PowerSync was alpha (v0.6) at time of decision.
- **Bun compatibility**: No WASM dependencies (unlike PowerSync which needs SQLite WASM).

### 7.2 Why vite-plugin-pwa (not post-build Bun script)

The original plan proposed a standalone `scripts/generate-sw.ts` post-build script using `workbox-build.injectManifest()` to avoid TanStack Start compatibility issues with `vite-plugin-pwa`. However, `vite-plugin-pwa` v1.2 with `injectManifest` strategy works with the current Vite 7 + Bun setup, so it was adopted for simplicity (single config, no separate build step).

### 7.3 Why Custom Mutation Queue (not off-the-shelf)

No mature, drop-in offline mutation queue exists that works with arbitrary REST APIs (Eden treaty) and TanStack Query. The custom Dexie-based outbox pattern (~200 lines) gives full control over retry logic, conflict resolution, and ordering without framework coupling.

### 7.4 POS-First Offline Strategy

POS was chosen as the first offline-capable feature because:
1. Retail stores frequently experience network outages.
2. Cashiers need uninterrupted selling capability.
3. New sales orders (create) have zero conflict risk (unique IDs).
4. Stock deduction only happens on SHIPPED status transition, which requires online confirmation.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: **Amazon S3** (or compatible) — Image storage for products and variants. Images are cached by Service Worker but never stored in IndexedDB.

### Third-Party Services

- **SVC-001**: **better-auth** — Authentication and session management. Auth endpoints are excluded from all caching.
- **SVC-002**: **Prisma / PostgreSQL** — Server-side data persistence. Sync endpoints use existing Prisma queries with `updatedAt` delta filtering.

### Infrastructure Dependencies

- **INF-001**: **Service Worker API** — Required for app shell caching and API response caching. Supported in all modern browsers.
- **INF-002**: **IndexedDB API** — Required for structured offline data storage. Supported in all modern browsers.
- **INF-003**: **Navigator.onLine / online/offline events** — Used for connectivity detection to trigger sync and toggle UI state.

### Technology Platform Dependencies

- **PLT-001**: **Bun** — Runtime for backend and frontend dev server/build.
- **PLT-002**: **Elysia.js** — Backend framework for sync API endpoints.
- **PLT-003**: **React 19** — Frontend UI framework.
- **PLT-004**: **TanStack Query** — Server-state cache layer; offline features complement but do not replace it.
- **PLT-005**: **Dexie.js 4.x** — IndexedDB wrapper (`dexie`, `dexie-react-hooks`).
- **PLT-006**: **Workbox 7.x** — Service Worker toolkit (`workbox-build`, `workbox-routing`, `workbox-strategies`, `workbox-precaching`, `workbox-expiration`).
- **PLT-007**: **vite-plugin-pwa 1.x** — Vite plugin for PWA/service worker generation with `injectManifest` strategy.

### Data Dependencies

- **DAT-001**: **PostgreSQL `updatedAt` column** — All syncable models must have an `updatedAt` timestamp column for delta sync. This is enforced by existing Prisma schema conventions.

## 9. Examples & Edge Cases

### 9.1 POS Offline Transaction Flow

```
1. Cashier scans barcode (offline)
   → useOfflineVariants reads from IndexedDB
   → Variant found, added to cart

2. Cashier completes payment (offline)
   → useOfflineMutation detects offline
   → enqueueMutation({ model: 'sales-orders', operation: 'create', data: {...} })
   → Returns tempId: 'offline_550e8400-...'
   → Toast: "Transaksi disimpan offline. Akan disinkronkan otomatis."
   → SyncStatusBadge shows "1 menunggu"

3. Network reconnects
   → 'online' event fires
   → processMutationQueue() sends to POST /sync/batch
   → Server creates real sales order, returns serverId
   → markMutationSynced(id) removes from queue
   → TanStack Query cache invalidated
   → SyncStatusBadge returns to online state
```

### 9.2 Mutation Conflict Handling

```
1. Offline mutation enqueued (sales order update with stale status)
2. On sync, server rejects: "Cannot transition from DRAFT to SHIPPED"
3. processSyncResults marks mutation as 'conflict'
4. SyncStatusBadge shows orange with pending count
5. User clicks badge → ConflictDialog opens
6. User sees: "Sales Order - update - Cannot transition from DRAFT to SHIPPED"
7. User clicks "Coba Lagi" (Retry) or "Buang" (Discard)
```

### 9.3 Organization Switch Data Isolation

```
1. User is in Org A, has synced 500 products
2. User switches to Org B
3. clearOrgData('org-a-id') deletes:
   - All products, variants, categories, customers, warehouses, suppliers
   - All sales orders and stock snapshots
   - All pending mutations
   - All sync meta entries
4. syncAllModels() fetches Org B data from GET /sync/initial
5. IndexedDB now contains only Org B data
```

### 9.4 Edge Cases

- **Multiple tabs**: Service Worker is shared across tabs. Background sync runs once but all tabs see sync status via the pub/sub mechanism in `sync.ts`.
- **Rapid org switching**: `useSyncInit` uses `useRef` flags to prevent double-syncing and ensures cleanup of the previous org's data before re-syncing.
- **Queue processing interruption**: If `processMutationQueue` fails mid-batch (network error), mutations marked as `'syncing'` are reverted to `'pending'` on the next sync cycle.
- **Batch size limit**: The batch endpoint accepts 1-50 mutations. `buildBatchPayload` does not currently enforce this limit client-side; the server returns a validation error if exceeded.
- **Stock conflict on sync**: Stock movements and adjustments are not yet supported for offline writes. Sales order creation does not modify stock until status changes to SHIPPED, which requires online confirmation.

## 10. Validation Criteria

| ID | Criterion | Validation Method |
|----|-----------|-------------------|
| **VC-001** | App loads and renders from Service Worker cache when offline | DevTools Network throttling + Application > Service Workers |
| **VC-002** | IndexedDB contains data for all 6 syncable models after initial sync | DevTools Application > IndexedDB after login |
| **VC-003** | POS product search returns results from IndexedDB when offline | Disable network, search product in POS, verify results |
| **VC-004** | Offline sales order creation stores in mutation queue with temp ID | Disable network, create order, check IndexedDB `mutationQueue` table |
| **VC-005** | Queued mutations sync on reconnection and TanStack Query is invalidated | Enable network, verify order appears in sales orders list |
| **VC-006** | Failed mutations surface in ConflictDialog after 5 retries | Mock server rejection, verify dialog appears with retry/discard options |
| **VC-007** | Organization switch clears all IndexedDB data | Switch org, verify IndexedDB is empty before new sync |
| **VC-008** | Background sync runs every 5 minutes | Monitor Network tab for periodic `/sync/delta` requests |
| **VC-009** | Auth endpoints are never cached by Service Worker | Check Service Worker cache storage for `/api/auth/*` entries (should be empty) |
| **VC-010** | Sync status indicator updates reactively | Toggle network, verify indicator color/label changes |

## 11. Changelog (from previous version)

This is the initial specification (v1), derived from `plans/offline-first.md` and adjusted to reflect the actual implementation state.

### Key deviations from the plan

- **Service Worker generation**: Plan proposed `scripts/generate-sw.ts` post-build script; implementation uses `vite-plugin-pwa` with `injectManifest` strategy.
- **Scope**: Plan outlined 3 phases (SW, Dexie read cache, mutation queue). Implementation covers all three phases for POS but dashboard pages do not yet use `useOfflineData`.
- **Batch endpoint models**: Only `sales-orders` and `customers` are supported for offline mutations (plan mentioned stock movements and product updates as future candidates).
- **No merge conflict UI**: Plan mentioned showing server vs. client state for manual resolution; current implementation only supports retry or discard.

## 12. Related Specifications / Further Reading

- [plans/offline-first.md](../../plans/offline-first.md) — Original implementation plan
- [Dexie.js Documentation](https://dexie.org/docs/) — IndexedDB wrapper API reference
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/) — Service Worker toolkit reference
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Vite PWA plugin configuration
