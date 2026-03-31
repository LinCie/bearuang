# Offline-First Implementation Plan

## 1. Current Codebase Overview

### 1.1 What BearUang Is

BearUang is a multi-tenant inventory and point-of-sale (POS) management system for organizations. The UI language is Indonesian (Bahasa Indonesia). It follows a typical admin dashboard pattern with CRUD management for all business entities.

### 1.2 Frontend Routes & Features

| Route | Feature | Read/Write Profile |
|-------|---------|-------------------|
| `/signin`, `/signup` | Auth (better-auth) | Write (auth flow) |
| `/organizations` | Org selection/creation | Read + Write |
| `/_dashboard/` | Dashboard with summary, recent orders, stock health reports | **Read-heavy** |
| `/_dashboard/pos/` | **Point of Sale** — product search, barcode scanning, cart, checkout, receipt | **High write** (orders) |
| `/_dashboard/products/` | Product CRUD with images | Read + Write |
| `/_dashboard/variants/` | Variant CRUD with SKU lookup, images | Read + Write |
| `/_dashboard/product-categories/` | Category tree management | Read + Write |
| `/_dashboard/warehouses/` | Warehouse management | Read + Write |
| `/_dashboard/stock-movements/` | Stock adjustment history (IN/OUT/ADJUSTMENT) | **High write** |
| `/_dashboard/suppliers/` | Supplier management | Read + Write |
| `/_dashboard/customers/` | Customer management | Read + Write |
| `/_dashboard/purchase-orders/` | Purchase order management | Read + Write |
| `/_dashboard/sales-orders/` | Sales order management with status workflow | Read + Write |
| `/_dashboard/members/` | Org member management | Read + Write |
| `/_dashboard/api-keys/` | API key management | Read + Write |
| `/_dashboard/audit-logs/` | Audit log viewer | **Read-only** |
| `/_dashboard/settings/` | App settings | Read + Write |
| `/_dashboard/uploads/` | File/media uploads (S3) | Write (S3 uploads) |

### 1.3 Backend API Modules (17 modules)

All modules follow the Elysia plugin pattern with `authPlugin` providing `requireAuth`, `requireOrg`, and `requirePermission` guards.

| Module | Prefix | Key Operations |
|--------|--------|---------------|
| Products | `/products` | CRUD, soft-delete, image management |
| Variants | `/variants` | CRUD, SKU lookup, search, image management |
| Product Categories | `/product-categories` | CRUD with tree structure |
| Warehouses | `/warehouses` | CRUD |
| Stock Movements | `/stock-movements` | Create/list/delete, atomic stock updates |
| Suppliers | `/suppliers` | CRUD |
| Customers | `/customers` | CRUD |
| Purchase Orders | `/purchase-orders` | CRUD with status workflow |
| Sales Orders | `/sales-orders` | CRUD with status workflow, stock side-effects on SHIPPED/CANCELLED |
| API Keys | `/api-keys` | CRUD |
| Members | `/members` | CRUD |
| Invitations | `/invitations` | CRUD |
| Roles | `/roles` | CRUD with permissions |
| Permissions | `/permissions` | View |
| Dashboard | `/dashboard` | Aggregated summary, recent orders, reports |
| Uploads | `/uploads` | S3 presigned URL generation |
| Audit Logs | `/audit-logs` | Read-only query |

### 1.4 Data Models (Prisma Schema)

Core domain models (17 models):

- **User / Session / Account / Verification** — Auth (via better-auth)
- **Organization / Member / Invitation** — Multi-tenancy
- **OrganizationRole / Apikey** — Authorization
- **ProductCategory** — Hierarchical categories (self-referential via `parentId`)
- **Product / ProductVariant** — Products with multiple variants, soft-delete
- **Warehouse** — Physical storage locations
- **StockMovement** — Stock IN/OUT/ADJUSTMENT with atomic stock cache updates
- **Supplier / Customer** — Business contacts
- **PurchaseOrder / PurchaseOrderItem** — Procurement with status workflow
- **SalesOrder / SalesOrderItem** — Sales with status workflow
- **ProductImage / VariantImage / Media** — File attachments via S3
- **AuditLog** — Immutable audit trail

### 1.5 Data Relationship Map for Offline Sync

```
Organization
├── ProductCategory (tree structure, small)
│   └── Product (with ProductImage)
│       └── ProductVariant (with VariantImage) ← POS barcode lookup target
│           └── StockMovement (referenced by sales/purchase orders)
├── Warehouse (very small)
├── Customer (medium)
├── Supplier (medium)
├── SalesOrder
│   ├── SalesOrderItem → ProductVariant (stock deduction on SHIPPED)
│   └── Customer (optional)
├── PurchaseOrder
│   ├── PurchaseOrderItem → ProductVariant (stock addition on RECEIVED)
│   └── Supplier
└── AuditLog (append-only, read-only)
```

Key relationships for offline:

- **Sales Order → Stock Movement**: Creating/shipping an order atomically updates stock. Offline orders must queue both operations.
- **Product Variant stock**: Denormalized cache field, updated exclusively by StockMovement service. Multiple concurrent writes are the #1 conflict risk.
- **Category tree**: Parent-child self-reference requires careful sync ordering (parent before child).

---

## 2. Offline-First Candidate Analysis

### 2.1 Tier 1 — Critical Offline Candidates (Highest Value)

| # | Feature | Rationale | Read/Write | Conflict Risk |
|---|---------|-----------|------------|---------------|
| 1 | **POS (Point of Sale)** | The #1 candidate. Retail stores experience network outages. Cashiers need to keep selling. Barcode scanning, cart management, and checkout are latency-sensitive. Currently uses `usePosCart` (local reducer) + `useCreateSalesOrder` (mutation). | Both | **High** — stock deduction conflicts possible if multiple cashiers. Must handle gracefully. |
| 2 | **Product/Variant Catalog (Read)** | POS and order creation depend on product lookup. Barcode scanning calls `/variants/lookup` on every scan. Product list, search, and detail views should be cached. | **Read-only** | None (read cache) |
| 3 | **Customer List (Read)** | Needed at checkout and order management. Small dataset per org. | **Read-only** | None (read cache) |
| 4 | **Warehouse List (Read)** | Needed at checkout and stock management. Very small dataset per org (usually 1-5). | **Read-only** | None (read cache) |

### 2.2 Tier 2 — High-Value Offline Candidates

| # | Feature | Rationale | Read/Write | Conflict Risk |
|---|---------|-----------|------------|---------------|
| 5 | **Stock Levels (Read + Write)** | Stock movements and adjustments. If stock adjustments happen offline (e.g., physical inventory count), they need to sync without overwriting concurrent changes. | Both | **High** — concurrent stock modifications |
| 6 | **Sales Order Management** | Viewing and updating order status (SHIPPED, DELIVERED, COMPLETED). The status transition logic is server-enforced, so updates must be validated on sync. | Both | **Medium** — status transitions are governed by a state machine |
| 7 | **Dashboard** | Summary metrics, recent orders, stock reports. Useful offline for quick reference but will be stale. | **Read-only** | None (stale cache is acceptable) |

### 2.3 Tier 3 — Nice-to-Have Offline

| # | Feature | Rationale | Read/Write | Conflict Risk |
|---|---------|-----------|------------|---------------|
| 8 | **Supplier/Customer CRUD** | Adding new customers at POS when offline. | Write | **Low** — new records, unlikely to conflict |
| 9 | **Purchase Orders** | Less critical for offline, but useful for procurement on the go. | Both | Medium |
| 10 | **Product Category Management** | Rare write operations, small dataset. | Both | Low |
| 11 | **Audit Logs** | Read-only reference. Large dataset, low priority for offline. | **Read-only** | None |
| 12 | **Members/Roles/Permissions** | Admin-only, infrequent changes. | Both | Low |

### 2.4 Tier 4 — Not Appropriate for Offline

| Feature | Why Not |
|---------|---------|
| Auth (signin/signup) | Requires server-side validation. Cannot work offline. |
| Organization creation | Server-side operation. |
| File uploads | Large binary payloads, no practical offline sync without IndexedDB binary storage (very complex). |
| API key management | Security-sensitive, should always be server-validated. |
| Real-time collaboration | No WebSocket/SSE infrastructure exists yet, but multi-user conflicts already exist implicitly. |

---

## 3. Recommended Tech Stack

### 3.1 Decision Matrix

| Criterion | Dexie + Workbox | TanStack DB + PowerSync | WatermelonDB | RxDB |
|-----------|----------------|------------------------|-------------|------|
| TanStack Start compatibility | ✅ Proven | ⚠️ Beta, no SSR yet | ✅ Works | ✅ Works |
| Bun runtime compat | ✅ Native | ⚠️ Needs SQLite WASM | ⚠️ React Native focus | ✅ Works |
| React 19 compat | ✅ dexie-react-hooks | ✅ @tanstack/react-db | ✅ Observables | ✅ Hooks |
| Conflict resolution | 🔧 Custom (flexible) | ✅ Built-in LWW + custom | ✅ Advanced | ✅ CRDT-based |
| Bundle size impact | 🟢 Small (~15KB) | 🟡 Medium (SQLite WASM) | 🟡 Medium | 🔴 Large |
| Learning curve | 🟢 Low | 🟡 Medium-High | 🔴 High | 🔴 High |
| Migration complexity | 🟢 Incremental | 🔴 Rewrite needed | 🔴 Rewrite needed | 🔴 Rewrite needed |
| Backend changes needed | 🟡 Minimal (sync endpoints) | 🟡 Sync protocol | 🟡 Sync adapter | 🔴 RxDB backend |
| Production maturity | ✅ Battle-tested | ⚠️ Alpha (v0.6) | ✅ Mature | ✅ Mature |

### 3.2 Core Recommendation: Dexie.js + Workbox + Custom Sync Layer

Given the specific constraints of this project (TanStack Start SSR, Bun, Elysia, React 19, no framework lock-in), a **pragmatic, incremental approach** is recommended over a full local-first framework.

#### Layer 1: Service Worker & App Shell Caching

| Library | Version | Purpose |
|---------|---------|---------|
| **Workbox** (workbox-build, workbox-routing, workbox-strategies, workbox-precaching, workbox-expiration) | 7.x | Service worker generation and runtime caching strategies |

**Why Workbox over vite-plugin-pwa/Serwist:**

- **vite-plugin-pwa** does NOT work with TanStack Start production builds (Issue #4988 on TanStack/router, open with 19+ upvotes). The build hooks are incompatible with TanStack Start's Vite environment API.
- **Serwist** has the same issue (Issue #300 on serwist/serwist, open). A community workaround exists using a custom Vite plugin, but it's fragile.
- **Workbox directly** via a post-build script is the proven approach. A community guide at robelest.com demonstrates this pattern specifically for TanStack Start + Bun. It uses `workbox-build`'s `injectManifest` in a post-build Bun script, completely bypassing Vite plugin incompatibilities.

#### Layer 2: IndexedDB Client Database

| Library | Version | Purpose |
|---------|---------|---------|
| **Dexie.js** | 4.x | IndexedDB wrapper for structured offline data storage |
| **dexie-react-hooks** | latest | `useLiveQuery()` for reactive IndexedDB queries |

**Why Dexie.js:**

- Most mature, battle-tested IndexedDB wrapper (12K+ GitHub stars)
- Excellent TypeScript support
- `dexie-react-hooks` provides `useLiveQuery()` for reactive, auto-updating queries — integrates naturally with React 19
- Lightweight (~15KB gzipped)
- Supports schema versioning/migrations for incremental evolution
- Well-documented, large ecosystem
- No external dependencies, no vendor lock-in
- Works perfectly alongside TanStack Query (complementary, not competing)

**Why NOT other options:**

- **idb**: Lower-level wrapper, no reactive hooks, more boilerplate. Fine as a primitive but Dexie provides more value.
- **TanStack DB + PowerSync**: Very promising (v0.6 just released Mar 2026 with persistence and offline support), but it's still in beta, SSR support is not yet available, and it would require a significant architecture rewrite. Worth monitoring for v1.
- **WatermelonDB**: Designed for React Native first, heavier for web, requires schema definition that duplicates Prisma. Overkill for this use case.
- **RxDB**: Heaviest option, real-time sync built-in but brings its own complexity. Overkill.

#### Layer 3: Offline Mutation Queue & Sync

| Component | Purpose |
|-----------|---------|
| **Custom mutation queue** (built on Dexie) | Queues offline mutations for later sync |
| **TanStack Query** (existing) | Orchestrates cache invalidation after sync |

**Why custom rather than off-the-shelf:**

- There is no mature, drop-in offline mutation queue that works with arbitrary REST APIs (Eden treaty) and TanStack Query.
- `@tanstack/offline-transactions` exists for TanStack DB but is tightly coupled to that ecosystem.
- A simple Dexie-based outbox table + sync loop is ~200 lines of code and gives full control over retry logic, conflict resolution, and ordering.
- This approach is the standard pattern recommended by Dexie's own documentation for offline sync.

---

## 4. Implementation Architecture

### 4.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Browser (Client)                    │
│                                                      │
│  ┌──────────────┐    ┌───────────────────────────┐   │
│  │   React UI   │◄──►│   TanStack Query Cache    │   │
│  │  (React 19)  │    │   (existing, 1min stale)  │   │
│  └──────┬───────┘    └───────────┬───────────────┘   │
│         │                        │                    │
│         │  useLiveQuery()        │  queryFn           │
│         ▼                        ▼                    │
│  ┌──────────────┐    ┌───────────────────────────┐   │
│  │   Dexie.js   │    │   Offline-Aware Fetcher   │   │
│  │  (IndexedDB) │    │   (intercepts api calls)  │   │
│  │              │    └───────────┬───────────────┘   │
│  │ - products   │                │                    │
│  │ - variants   │                │                    │
│  │ - customers  │                ▼                    │
│  │ - warehouses │    ┌───────────────────────────┐   │
│  │ - orders     │    │   Mutation Queue (Dexie)  │   │
│  │ - movements  │    │   (offline outbox table)  │   │
│  └──────────────┘    └───────────┬───────────────┘   │
│                                  │                    │
│                                  ▼                    │
│                       ┌─────────────────────┐        │
│                       │   Sync Engine       │        │
│                       │   (background loop) │        │
│                       └─────────┬───────────┘        │
└─────────────────────────────────┼────────────────────┘
                                  │
                           Service Worker
                           (Workbox caching)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────┐
│                   Server (Backend)                   │
│                                                     │
│  ┌───────────────┐    ┌────────────────────────┐    │
│  │   Elysia API  │◄──►│   Prisma / PostgreSQL  │    │
│  │   (existing)  │    │   (existing)           │    │
│  └───────┬───────┘    └────────────────────────┘    │
│          │                                          │
│  ┌───────┴────────┐    ┌────────────────────────┐   │
│  │ /sync/batch    │◄──►│   Conflict Resolver    │   │
│  │ (new endpoint) │    │   (server-side)        │   │
│  └────────────────┘    └────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 5. Phase 1: Service Worker & App Shell (Week 1-2)

### 5.1 Goal

The app loads and renders offline with cached HTML/JS/CSS, even if data is stale.

### 5.2 Deliverables

| # | File | Description |
|---|------|-------------|
| 1 | `packages/frontend/src/sw.ts` | Service worker with Workbox routing |
| 2 | `packages/frontend/scripts/generate-sw.ts` | Post-build SW generation script |
| 3 | `packages/frontend/vite.config.ts` | Update build config (manifest only) |
| 4 | `packages/frontend/package.json` | Chain `build` → `generate-sw` |
| 5 | `packages/frontend/src/routes/__root.tsx` | Service worker registration |

### 5.3 Caching Strategy

| Request Type | Strategy | Rationale |
|-------------|----------|-----------|
| Navigation (HTML) | NetworkFirst (3s timeout) | Serve SSR HTML when online, fall back to cache |
| API calls (`/api/*`) | NetworkFirst (3s timeout) | Stale data is better than no data |
| Static assets (JS/CSS/fonts) | CacheFirst (7 days) | Immutable with content hashing |
| Images (S3) | CacheFirst (30 days) | Large, rarely change |

### 5.4 Service Worker Implementation Pattern

The service worker is generated via a post-build Bun script (not a Vite plugin) to avoid TanStack Start compatibility issues:

1. Bun transpiles `src/sw.ts` to JS
2. `workbox-build.injectManifest()` precaches static assets from the build output
3. Custom routing handles API caching, navigation fallback, and image caching
4. The generated SW is placed in the build output directory

### 5.5 Dependencies

```
workbox-build
workbox-routing
workbox-strategies
workbox-precaching
workbox-expiration
```

---

## 6. Phase 2: Dexie.js Read Cache (Week 3-4)

### 6.1 Goal

Product catalog, customers, and warehouses available instantly from IndexedDB, synced in background.

### 6.2 Deliverables

| # | File | Description |
|---|------|-------------|
| 1 | `packages/frontend/src/lib/db.ts` | Dexie database definition with schema |
| 2 | `packages/frontend/src/lib/sync.ts` | Data sync service (initial load + delta) |
| 3 | `packages/frontend/src/hooks/use-offline-data.ts` | Hook that reads from Dexie first, then TanStack Query |
| 4 | `packages/backend/src/plugins/sync-plugin.ts` | Sync endpoints for initial + delta data |
| 5 | `packages/frontend/src/components/ui/offline-indicator.tsx` | UI component showing online/offline/syncing status |

### 6.3 Dexie Schema

```typescript
import Dexie from 'dexie';

const db = new Dexie('bearuang-offline', {
  autoOpen: true,
});

db.version(1).stores({
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
```

### 6.4 Sync Flow

1. On login/org-switch, fetch initial data from `GET /sync/initial`
2. Store in Dexie tables
3. TanStack Query reads from Dexie first, falls back to network
4. Background periodic sync (every 5 min when online) fetches deltas via `updatedAt > lastSync`

### 6.5 Offline-Aware Query Pattern

```typescript
function offlineAwareQueryFn<T>(
  dexieTable: Dexie.Table<T>,
  networkFn: () => Promise<T>,
  queryKey: string[],
) {
  return async (): Promise<T> => {
    const cached = await dexieTable.toArray();
    if (cached.length > 0) {
      queryClient.invalidateQueries({ queryKey });
      return cached as unknown as T;
    }
    const data = await networkFn();
    await dexieTable.bulkPut(data);
    return data;
  };
}
```

### 6.6 Backend: Sync Endpoints

#### `GET /sync/initial`

- Query params: `models=products,variants,customers,warehouses,categories,suppliers`
- Returns: `{ models: { products: [...], variants: [...], ... }, syncTimestamp: string }`
- Uses existing serialization functions from route files

#### `GET /sync/delta?since=<ISO timestamp>&models=products,variants`

- Returns only records with `updatedAt > since`
- Supports soft-deleted records (includes `deletedAt` field)

---

## 7. Phase 3: Offline Mutation Queue (Week 5-7)

### 7.1 Goal

POS can create sales orders offline. Stock adjustments can be made offline. Mutations queue and sync when reconnected.

### 7.2 Deliverables

| # | File | Description |
|---|------|-------------|
| 1 | `packages/frontend/src/lib/mutation-queue.ts` | Queue manager with retry/backoff |
| 2 | `packages/frontend/src/lib/sync.ts` | Enhanced with mutation processing |
| 3 | `packages/frontend/src/hooks/use-offline-mutation.ts` | Hook wrapping mutations for offline support |
| 4 | `packages/backend/src/plugins/sync-plugin.ts` | `POST /sync/batch` endpoint |
| 5 | `packages/frontend/src/components/ui/conflict-dialog.tsx` | UI for manual conflict resolution |
| 6 | `packages/frontend/src/components/ui/sync-status-badge.tsx` | Sync status indicator for POS |

### 7.3 Mutation Queue Design

```typescript
interface QueuedMutation {
  id?: number;
  model: string;
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: string;
  syncedAt: string | null;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error?: string;
  retries: number;
  dependsOn?: number;
}
```

### 7.4 Mutation Sync Flow

1. User performs action offline → mutation saved to Dexie `mutationQueue`
2. Optimistic update applied to local Dexie data
3. Background sync loop detects connectivity (via `navigator.onLine` + SW messages)
4. Processes queue in FIFO order (respecting dependencies)
5. Sends to `POST /sync/batch` as a batch
6. Server processes, returns results with any conflicts
7. Client updates local state based on server response
8. Failed mutations go to retry queue (exponential backoff, max 5 retries)
9. Irreconcilable conflicts surface in UI for manual resolution

### 7.5 Backend: Batch Mutation Endpoint

#### `POST /sync/batch`

- Accepts array of mutations with client-generated temp IDs
- Processes in transaction where possible
- Returns: `{ results: [{ tempId, serverId, status: 'success' | 'conflict', conflictData? }] }`
- For stock movements: validates current stock state, applies delta or returns conflict

### 7.6 Conflict Resolution Strategy (Server-Side)

| Model | Strategy | Rationale |
|-------|----------|-----------|
| SalesOrder (create) | **Accept all** (new records) | New orders can't conflict — they have unique IDs |
| SalesOrder (status update) | **State machine validation** | Server enforces STATUS_TRANSITIONS. If offline client has stale state, reject and return current state |
| StockMovement | **Optimistic merge with reconciliation** | Apply the delta. If stock goes negative, flag as conflict and require manual review |
| Product/Variant (update) | **Last-write-wins** with version check | Simple for reference data. Return `412 Precondition Failed` if version mismatch |
| Customer/Supplier (create) | **Accept all** (new records) | New records, no conflict possible |

---

## 8. Risks and Considerations

### 8.1 Conflict Resolution Complexity

**Risk: HIGH**

BearUang has a denormalized stock cache on `ProductVariant.stock` that is updated atomically within transactions by the StockMovement service. When multiple users (or the same user offline) create stock movements, the offline mutations may be based on stale stock levels.

**Mitigation:**

- Phase 3 should start with POS-only offline (new sales orders only). New orders don't modify stock until status changes to SHIPPED, which should always be an online operation.
- Stock adjustments (ADJUSTMENT type) should require online confirmation.
- If stock movement conflicts are detected during sync, surface a clear UI showing: "Stock was modified while offline. Current stock: X, your adjustment: Y. Please confirm."
- Consider adding an `optimisticLockVersion` column to `ProductVariant` for lightweight conflict detection.

### 8.2 Data Size Management

**Risk: MEDIUM**

IndexedDB has practical limits (~50MB per origin without user permission, ~unlimited with it).

**Estimated data sizes per organization:**

| Data | Typical Count | Avg Size/Record | Total |
|------|--------------|-----------------|-------|
| Products + Variants | 500 products, 2-3 variants each | ~1KB | ~1.5MB |
| Product Images (URLs only, not blobs) | 1000 images | ~200B | ~200KB |
| Customers | 200 | ~500B | ~100KB |
| Warehouses | 1-5 | ~300B | ~1.5KB |
| Sales Orders (recent 1000) | 1000 orders with items | ~2KB | ~2MB |
| Stock Movements (recent) | 500 | ~500B | ~250KB |
| **Total** | | | **~4MB** |

**Mitigation:**

- Store image URLs only, not binary blobs (images served from S3 via Service Worker cache)
- Implement data pagination in sync — only sync recent N records for high-volume tables
- Add periodic cleanup of old cached records
- Request persistent storage permission via `navigator.storage.persist()`

### 8.3 Sync Strategy

**Risk: MEDIUM**

| Data Type | Recommended Strategy |
|-----------|---------------------|
| Reference data (products, variants, categories, warehouses) | **Background sync** — Full initial load, then periodic delta sync via `updatedAt` |
| Transactional data (sales orders, stock movements) | **Event-driven sync** — Queue mutations, process on reconnect |
| Dashboard data | **Stale-while-revalidate** — Show cached, update when online |
| Auth/session data | **Online-only** — Never cache, always validate server-side |

### 8.4 TanStack Start + Service Worker Compatibility

**Risk: MEDIUM**

Neither vite-plugin-pwa nor Serwist work reliably with TanStack Start production builds.

**Mitigation:**

- Use the proven post-build Workbox approach (Bun script + `workbox-build`)
- The `generate-sw.ts` script runs after `vite build` and before deployment
- For Nitro 3 (which TanStack Start may use), output SW to `.output/public` instead of `dist/client`

### 8.5 TanStack Query Integration

**Risk: LOW**

The existing TanStack Query setup needs to be enhanced, not replaced.

**Approach:**

- Keep TanStack Query as the primary data fetching layer
- Add a custom `queryFn` wrapper that reads from Dexie first, then falls back to network
- On network success, write-through to Dexie
- This is the "stale-while-revalidate with IndexedDB" pattern
- Mutation invalidation already works correctly — just add Dexie writes on success

### 8.6 Security Considerations

**Risk: LOW-MEDIUM**

Offline data storage has security implications.

**Mitigations:**

- IndexedDB data is per-origin and not encrypted by default
- Sensitive data (API keys, full user credentials) should NOT be stored in IndexedDB
- Session tokens should remain in memory/cookies only
- Consider adding a client-side encryption layer for PII (customer data) using the Web Crypto API
- Service Worker should NOT cache auth endpoints
- Add a "clear offline data" option in settings for when a user logs out or switches organizations

### 8.7 Complexity Trade-offs

| Approach | Complexity | Offline Capability | Risk |
|----------|-----------|-------------------|------|
| **Phase 1 only (SW caching)** | 🟢 Low | Read-only (stale data) | 🟢 Low |
| **Phase 1 + 2 (Dexie read cache)** | 🟡 Medium | Read-only (fast, structured) | 🟢 Low |
| **Phase 1 + 2 + 3 (Full offline)** | 🔴 High | Read + Write (full POS) | 🟡 Medium |
| **Full rewrite with TanStack DB + PowerSync** | 🔴 Very High | Full local-first | 🔴 High (beta software) |

### 8.8 Monitoring & Observability

- Track sync success/failure rates
- Monitor IndexedDB storage usage
- Log conflict resolution events to the existing `AuditLog` model
- Add `offline_created` flag to sales orders created offline (so staff know to verify)
- Surface sync status prominently in the POS UI (green dot = online, yellow = syncing, red = offline with queued changes)

---

## 9. Summary & Recommendation

BearUang is a well-structured inventory/POS system with 17 backend modules and 16+ frontend routes. The **POS** and **product catalog** are the strongest candidates for offline support.

**Recommended approach: Dexie.js + Workbox with a custom sync layer**

Implemented incrementally across three phases:

1. **Phase 1 (Week 1-2):** Service Worker via Workbox post-build script — app loads offline
2. **Phase 2 (Week 3-4):** Dexie read cache — product/variant/customer data available instantly
3. **Phase 3 (Week 5-7):** Offline mutation queue — POS can create orders offline

The biggest risk is **stock conflict resolution** during offline writes, which should be deferred to Phase 3 and carefully designed with server-side validation. The TanStack Start + service worker compatibility is solved via the post-build Workbox pattern (proven by the community).

**Start with Phase 1 + 2** — delivers 80% of the value (instant catalog loading, offline dashboard, resilient POS product search) with 20% of the risk. Phase 3 (offline writes) should be planned but only implemented after Phase 2 is stable and the product team confirms the need for fully offline POS transactions.
