---
title: POS (Point of Sale) Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: pos
tags: [pos, cart, checkout, payment, receipt, offline, mutation-queue, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the POS (Point of Sale) module in BearUang. The POS module is a **frontend-only module** — it has no dedicated backend route or service files. Instead, it consumes the existing sales-orders backend endpoints (`POST /sales-orders`) to create orders and is the **primary consumer of the offline-first architecture**, enabling offline-capable product search, cart management, checkout, and order creation.

## 1. Purpose & Scope

This specification defines:

- **Frontend module structure**: React components, custom hooks, route page, and module barrel exports
- **POS workflow**: Product search/barcode scan → cart management → checkout → payment → receipt
- **Offline capabilities**: IndexedDB-backed product search via `useOfflineVariants`, offline order creation via `useOfflineMutation` and the mutation queue
- **Cart state management**: `usePosCart` hook with reducer-based state for add, remove, update quantity, and clear
- **Checkout flow**: Warehouse and customer selection, guest name, payment method (CASH/QRIS/TRANSFER/CARD)
- **Receipt generation**: Dialog-based receipt with line items, totals, payment method, and print support
- **Sales order creation**: How POS creates sales orders via `POST /sales-orders` and the `useOfflineMutation` hook
- **Conflict resolution**: Integration with `SyncStatusBadge` and `ConflictDialog` for failed offline mutations

**Audience**: Developers building or modifying the POS experience, or developers implementing new offline-capable modules that follow the same patterns.

**Assumptions**: The reader is familiar with React 19, TanStack Query, TanStack Router, Dexie.js, the mutation queue (`mutation-queue.ts`), sync pipeline (`sync.ts`), and `useOfflineMutation` hook. The reader has read the [offline-first specification](../offline-first/spec-v1.md).

## 2. Definitions

| Term | Definition |
|------|-----------|
| **POS (Point of Sale)** | The frontend module at `/_dashboard/pos` that provides a cashier interface for creating sales orders |
| **Cart** | A client-side collection of `CartItem` objects (variant + quantity) managed by `usePosCart` via `useReducer` |
| **CartItem** | An object containing a `VariantWithProduct` and a `quantity: number` |
| **VariantWithProduct** | A product variant joined with its parent product name, sourced from the variants API or IndexedDB |
| **Checkout** | The flow of confirming warehouse, customer, and initiating payment for the cart contents |
| **Payment Method** | One of four payment types: `CASH`, `QRIS`, `TRANSFER`, `CARD` |
| **Receipt** | A printable transaction summary shown after successful order creation |
| **Barcode Scan** | Fast keystroke input detected by a 200ms buffer in `PosProductSearch` that triggers `useVariantLookup` |
| **Offline Order** | A sales order created while offline, stored in the mutation queue with a temp ID, and synced on reconnection |
| **Temp ID** | A client-generated identifier (`offline_<uuid>`) assigned to offline-created records, replaced by server ID upon sync |
| **Mutation Queue** | An IndexedDB-backed outbox table (`mutationQueue`) that stores offline write operations for deferred server sync |
| **useOfflineMutation** | A custom hook wrapping TanStack Query-style mutation that enqueues to the mutation queue when offline or on network error |
| **useOfflineVariants** | A custom hook that fetches variants from the API when online and falls back to IndexedDB when offline |
| **useVariantLookup** | A custom hook for exact SKU lookup via API when online or IndexedDB when offline |
| **SyncStatusBadge** | A UI badge showing current sync state (online/offline/pending) with click-to-view-conflicts |
| **ConflictDialog** | A dialog for viewing, retrying, or discarding failed/conflicting mutations from the queue |

## 3. Requirements, Constraints & Guidelines

### 3.1 Module Architecture

- **REQ-001**: The POS module resides in `packages/frontend/src/modules/pos/` with `hooks/`, `components/`, and `index.ts`
- **REQ-002**: The POS route page is at `packages/frontend/src/routes/_dashboard/pos/index.tsx` — a single-page layout (no sub-routes)
- **REQ-003**: The POS module is frontend-only — no backend route, service, or Prisma model files exist for POS
- **REQ-004**: Order creation uses the existing `POST /sales-orders` endpoint via the Eden Treaty client (`api['sales-orders'].post(...)`)
- **REQ-005**: Barrel exports at every directory level: `hooks/index.ts`, `components/index.ts`, `modules/pos/index.ts`

### 3.2 Cart State Management

- **REQ-006**: Cart state is managed via `useReducer` with four action types: `ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QTY`, `CLEAR_CART`
- **REQ-007**: `ADD_ITEM` increments quantity if the variant already exists in the cart; otherwise adds a new item with quantity 1
- **REQ-008**: `UPDATE_QTY` with quantity ≤ 0 removes the item from the cart
- **REQ-009**: `clearCart` dispatches `CLEAR_CART` which sets items to an empty array
- **REQ-010**: Derived values `subtotal` (sum of `price × quantity` per item) and `itemCount` (sum of quantities) are computed on every render
- **REQ-011**: Cart state is ephemeral — not persisted to IndexedDB or localStorage. Navigating away from the POS page clears the cart

### 3.3 Product Search & Barcode Scanning

- **REQ-012**: `PosProductSearch` uses `useOfflineVariants` to fetch product variants with online/transparent fallback
- **REQ-013**: Product search is paginated (page 1, pageSize 24) and filtered by the current organization (`orgFilter`)
- **REQ-014**: Barcode scanning uses a 200ms keystroke buffer (`barcodeBuffer` ref + `setTimeout`) on the search input
- **REQ-015**: When `Enter` is pressed, the buffer contents are used as an SKU for exact lookup via `useVariantLookup`
- **REQ-016**: Single character keystrokes reset the buffer timer; `Ctrl`/`Meta` modifier keys are ignored
- **REQ-017**: Successful barcode lookup adds the variant to the cart and clears the search input
- **REQ-018**: Products in the grid show a quantity badge if they are already in the cart

### 3.4 Offline Product Data

- **REQ-019**: `useOfflineVariants` uses `useLiveQuery` from `dexie-react-hooks` to reactively read from IndexedDB
- **REQ-020**: When online, `useOfflineVariants` queries the API (`api.variants.get`) with `staleTime: 1000 * 60 * 5` (5 minutes)
- **REQ-021**: When the API returns data, it takes priority over IndexedDB data
- **REQ-022**: When offline or API returns no data, IndexedDB results are used with client-side pagination
- **REQ-023**: IndexedDB results are filtered to only active, non-deleted variants (`isActive && !deletedAt`)
- **REQ-024**: `useVariantLookup` queries the API (`api.variants.lookup.get`) when online, falls back to IndexedDB (`db.variants.where('sku').equals(sku).first()`) when offline

### 3.5 Checkout Panel

- **REQ-025**: `PosCheckoutPanel` requires warehouse selection (defaults to the first warehouse loaded)
- **REQ-026**: Customer selection is optional — defaults to "Tamu" (guest). Selecting "Tamu" shows a guest name input
- **REQ-027**: Warehouse and customer data are fetched via `useWarehouses` and `useCustomers` hooks (pageSize 100)
- **REQ-028**: Transaction settings (warehouse, customer, guest name) are configured via a `Dialog` triggered by a settings icon
- **REQ-029**: The checkout button ("Bayar") is disabled when the cart is empty or no warehouse is selected or processing is in progress
- **REQ-030**: A "clear cart" button (trash icon) is shown when the cart has items

### 3.6 Payment Dialog

- **REQ-031**: `PosPaymentDialog` displays the total amount and four payment method options: `CASH`, `QRIS`, `TRANSFER`, `CARD`
- **REQ-032**: For `CASH` payment, a "Jumlah Dibayar" (paid amount) input is required with the amount ≥ total
- **REQ-033**: Quick-amount buttons are shown for cash: exact total, rounded up to nearest 10,000, rounded up to nearest 50,000 (deduplicated)
- **REQ-034**: Change amount ("Kembalian") is displayed when the paid amount exceeds the total
- **REQ-035**: An offline warning banner is shown when `isOffline` is true
- **REQ-036**: The confirm button is disabled until a payment method is selected and (for CASH) the paid amount is valid
- **REQ-037**: Dialog state (selected method, paid amount) resets when the dialog closes

### 3.7 Receipt

- **REQ-038**: `PosReceipt` displays a printable receipt in a `Dialog` with monospace font
- **REQ-039**: When the order was created online, receipt data comes from the `SalesOrder` object returned by the API
- **REQ-040**: When the order was created offline, receipt data comes from the `pendingItems` (cart items) with a temporary offline order shape
- **REQ-041**: Receipt includes: store name ("BearUang"), date/time (Indonesian locale), order ID (first 8 chars, uppercased), line items (name, quantity × unit price, line total), total, payment method, paid amount (CASH only), and change (CASH only)
- **REQ-042**: "Cetak Struk" triggers `window.print()` — the receipt container has print-specific CSS classes (`print:max-w-none`, `print:p-0`, etc.)
- **REQ-043**: "Transaksi Baru" clears the cart, resets state, and closes the receipt dialog
- **REQ-044**: A loading spinner is shown while the offline order is being constructed

### 3.8 Order Creation & Offline Mutation

- **REQ-045**: POS creates sales orders via `useOfflineMutation` with `model: 'sales-orders'` and `operation: 'create'`
- **REQ-046**: The mutation function calls `api['sales-orders'].post(input)` where `input` includes `warehouseId`, `customerId`, `guestName`, `paymentMethod`, and `items` array
- **REQ-047**: Each cart item maps to a sales order item with `variantId`, `quantity`, and `unitPrice` (the variant's current price)
- **REQ-048**: On online success, the `SalesOrder` response is used for the receipt and cache is invalidated for `salesOrderKeys.lists()`, `variantKeys.lists()`, `variantKeys.all`, and `auditLogKeys.all`
- **REQ-049**: On online success, individual variant detail caches are also invalidated for each item's `variantId`
- **REQ-050**: When offline (or on network error), the mutation is enqueued with `enqueueMutation` and a `{ tempId, offline: true }` result is returned
- **REQ-051**: Offline order results are constructed as a temporary `SalesOrder`-shaped object with `status: 'PENDING'`, `paymentStatus: 'UNPAID'`, and offline-generated item IDs
- **REQ-052**: A success toast is shown: "Transaksi berhasil!" (online) or "Transaksi disimpan offline. Akan disinkronkan otomatis." (offline)
- **REQ-053**: On payment error, the payment dialog re-opens with the error message

### 3.9 Sync & Conflict Resolution

- **REQ-054**: A `SyncStatusBadge` is displayed in the POS page header, showing online/offline/syncing/pending state
- **REQ-055**: Clicking the `SyncStatusBadge` fetches conflict mutations via `getConflictMutations()` and opens the `ConflictDialog`
- **REQ-056**: The `ConflictDialog` supports retrying individual conflicts, discarding individual conflicts, retrying all, and discarding all
- **REQ-057**: On browser `online` event, `createOrder.syncNow()` is called to immediately process any queued mutations

### 3.10 UI & Layout

- **REQ-058**: POS uses a two-column layout: product search (left, flex-1) and cart/checkout panel (right, fixed width `w-80`/`w-96`)
- **REQ-059**: On mobile (below `lg` breakpoint), the layout stacks vertically with the cart below the search
- **REQ-060**: The POS page fills the full viewport height (`h-[calc(100vh-3.5rem)]`) with overflow handling
- **REQ-061**: Product search displays a responsive grid: 3 columns on mobile, 4 on `lg`, 5 on `xl`
- **REQ-062**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-063**: Currency is formatted as IDR with `id-ID` locale (`toLocaleString('id-ID')`)
- **REQ-064**: Product images use lazy loading (`loading="lazy"`) and a fallback placeholder SVG when no image is available

### 3.11 Constraints

- **CON-001**: Cart state is not persisted — refreshing the POS page or navigating away loses cart contents
- **CON-002**: `useOfflineVariants` requires an `orgFilter` to read from IndexedDB; without it, only API results are available
- **CON-003**: IndexedDB results in `useOfflineVariants` do not include variant images (`images: []`) since image URLs are not stored in the variants table
- **CON-004**: Barcode scanning relies on keyboard events; it does not integrate with a native camera barcode scanner API
- **CON-005**: The 200ms barcode buffer may not work reliably with all barcode scanner hardware — some scanners paste the entire code at once rather than emitting individual keystrokes
- **CON-006**: Stock validation is not enforced at the POS level — the backend handles stock constraints via `StockMovement` when the order status changes
- **CON-007**: The `amountPaid` field is not sent to the API for POS orders — only `paymentMethod` and `items` are included in the create payload
- **CON-008**: Offline orders use a manually constructed `SalesOrder`-shaped object that may diverge from the actual API response shape if the backend schema changes
- **CON-009**: `useOfflineMutation` does not automatically detect `TypeError` (network error) on all browsers — it checks for `fetch`, `network`, or `Failed to fetch` in the error message

### 3.12 Guidelines

- **GUD-001**: Use `usePosCart` for any cart-like functionality; do not implement custom cart state elsewhere
- **GUD-002**: Use `useOfflineVariants` instead of direct `useQuery` + API calls for POS product data to maintain offline capability
- **GUD-003**: Use `useOfflineMutation` for any new write operation that should work offline — follow the same pattern as the POS order creation
- **GUD-004**: When adding new payment methods, update the `PAYMENT_METHODS` array in `pos-payment-dialog.tsx` and the `PaymentMethod` type
- **GUD-005**: Co-locate type exports in the module barrel (`index.ts`) for cross-module imports

## 4. Interfaces & Data Contracts

### 4.1 Frontend Module Structure

```
modules/pos/
  index.ts                          # Barrel exports: components, hooks, types
  hooks/
    index.ts                        # Re-exports: usePosCart, CartItem, useVariantLookup, useOfflineVariants
    use-pos-cart.ts                 # Cart state management (useReducer)
    use-offline-variants.ts         # Online/transparent offline variant search
    use-variant-lookup.ts           # Exact SKU lookup (online → offline fallback)
  components/
    index.ts                        # Re-exports: PosProductSearch, PosCart, PosCheckoutPanel, PosPaymentDialog, PosReceipt, PaymentMethod
    pos-product-search.tsx          # Product grid + barcode scanning input
    pos-cart.tsx                    # Cart item list with quantity controls
    pos-checkout-panel.tsx          # Warehouse/customer settings + total + pay button
    pos-payment-dialog.tsx          # Payment method selection + cash amount input
    pos-receipt.tsx                 # Printable receipt dialog
```

### 4.2 Route Structure

```
_dashboard/
  pos/
    index.tsx                       # Single-page POS layout (no sub-routes)
```

### 4.3 Cart Types & Actions

```typescript
interface CartItem {
  variant: VariantWithProduct
  quantity: number
}

type VariantWithProduct = {
  id: string
  organizationId: string
  productId: string
  sku: string
  name: string
  price: number
  stock: number
  unit: string
  attributes: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  images: Array<{ media?: { url: string; altText?: string } }>
  product: { name: string }
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: VariantWithProduct }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { variantId: string; quantity: number } }
  | { type: 'CLEAR_CART' }

interface CartState {
  items: CartItem[]
}
```

### 4.4 usePosCart Hook Interface

```typescript
interface UsePosCartReturn {
  items: CartItem[]
  addItem: (variant: VariantWithProduct) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  clearCart: () => void
  subtotal: number
  itemCount: number
}

function usePosCart(): UsePosCartReturn
```

### 4.5 useOfflineVariants Hook Interface

```typescript
interface UseOfflineVariantsOptions {
  search?: string
  page?: number        // default: 1
  pageSize?: number    // default: 24
  orgFilter?: string   // organization ID for IndexedDB scoping
}

interface UseOfflineVariantsResult {
  data: PaginatedVariants | undefined
  isFetching: boolean
  isOffline: boolean
}

interface PaginatedVariants {
  data: VariantWithProduct[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

function useOfflineVariants(options?: UseOfflineVariantsOptions): UseOfflineVariantsResult
```

### 4.6 useVariantLookup Hook Interface

```typescript
interface UseVariantLookupReturn {
  lookupBySku: (sku: string) => Promise<VariantWithProduct | null>
  isLooking: boolean
}

function useVariantLookup(): UseVariantLookupReturn
```

### 4.7 Payment Method Type

```typescript
type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'CARD'

const PAYMENT_METHODS: Array<{
  value: PaymentMethod
  label: string              // 'Tunai', 'QRIS', 'Transfer', 'Kartu'
  icon: React.ElementType    // Banknote, QrCode, Building2, CreditCard
}>
```

### 4.8 Component Props Interfaces

```typescript
// PosProductSearch
interface PosProductSearchProps {
  onAddToCart: (variant: VariantWithProduct) => void
  cartItems: CartItem[]
}

// PosCart
interface PosCartProps {
  items: CartItem[]
  onUpdateQuantity: (variantId: string, quantity: number) => void
  onRemoveItem: (variantId: string) => void
}

// PosCheckoutPanel
interface PosCheckoutPanelProps {
  items: CartItem[]
  subtotal: number
  onCheckout: (data: {
    warehouseId: string
    customerId?: string
    guestName: string
  }) => void
  onClearCart?: () => void
  isProcessing: boolean
}

// PosPaymentDialog
interface PosPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  onConfirm: (paymentMethod: PaymentMethod, paidAmount?: number) => void
  isProcessing: boolean
  error?: string
  isOffline?: boolean
}

// PosReceipt
interface PosReceiptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: SalesOrder | null
  pendingItems?: CartItem[]
  paymentMethod: PaymentMethod
  paidAmount?: number
  onNewTransaction: () => void
}
```

### 4.9 Sales Order Creation Payload (POS → Backend)

```typescript
interface CreateOrderInput {
  warehouseId: string
  customerId?: string
  guestName: string
  paymentMethod: PaymentMethod
  items: Array<{
    variantId: string
    quantity: number
    unitPrice: number
  }>
}
```

This maps to the backend `POST /sales-orders` endpoint (`createSalesOrderDto` schema).

### 4.10 Offline Temp Order Shape

When an order is created offline, the POS page constructs a temporary `SalesOrder`-compatible object:

```typescript
interface OfflineTempOrder {
  id: string                     // tempId from useOfflineMutation
  organizationId: string         // empty string
  customerId: string | null
  customer: null
  warehouseId: string
  warehouse: { id: string; name: string }
  guestName: string
  guestEmail: null
  shippingAddress: {}
  status: 'PENDING'
  paymentStatus: 'UNPAID'
  paymentMethod: PaymentMethod
  amountPaid: string             // subtotal as string
  orderedAt: string              // ISO timestamp
  shippedAt: null
  note: null
  createdAt: string              // ISO timestamp
  updatedAt: string              // ISO timestamp
  items: Array<{
    id: string                   // 'offline-{index}'
    salesOrderId: string         // tempId
    variantId: string
    variant: { id: string; sku: string; name: string }
    quantity: number
    unitPrice: string
  }>
}
```

### 4.11 Receipt Data Structure

```typescript
interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number              // parsed from string to number for display
}
```

Receipt items are sourced from either `order.items` (online) or `pendingItems` (offline), normalized to the `ReceiptItem` shape.

### 4.12 Module Barrel Exports

```typescript
// modules/pos/index.ts
export {
  PosProductSearch,
  PosCart,
  PosCheckoutPanel,
  PosPaymentDialog,
  PosReceipt,
} from './components'
export { usePosCart } from './hooks'
export type { CartItem } from './hooks'
export type { PaymentMethod } from './components/pos-payment-dialog'
```

### 4.13 Cache Invalidation Patterns (POS → Sales Orders)

```typescript
// After successful online order creation:
queryClient.invalidateQueries({ queryKey: salesOrderKeys.lists() })
queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
queryClient.invalidateQueries({ queryKey: variantKeys.all })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })

// Per-item variant detail invalidation:
for (const item of order.items) {
  queryClient.invalidateQueries({
    queryKey: variantKeys.detail(item.variantId),
  })
}
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user on the POS page, When they type in the search box, Then product variants matching the search term are displayed in a grid (online from API, offline from IndexedDB)
- **AC-002**: Given a barcode scanner inputs an SKU followed by Enter, When the barcode buffer timer has not expired, Then `useVariantLookup` is called with the scanned SKU and the matching variant is added to the cart
- **AC-003**: Given a variant is already in the cart, When the user clicks the variant grid button again, Then the quantity is incremented by 1 (not duplicated)
- **AC-004**: Given the cart has items, When the user decreases a variant's quantity to 0 or below, Then the item is removed from the cart
- **AC-005**: Given no warehouse is selected, When the user views the checkout panel, Then the "Bayar" button is disabled
- **AC-006**: Given the cart is empty, When the user views the checkout panel, Then the "Bayar" button is disabled and the cart area shows "Keranjang kosong"
- **AC-007**: Given a cart with items and a warehouse selected, When the user clicks "Bayar", Then the payment dialog opens showing the total and four payment method options
- **AC-008**: Given `CASH` payment is selected, When the paid amount is less than the total, Then the "Konfirmasi" button is disabled and the change shows as negative (destructive color)
- **AC-009**: Given `CASH` payment is selected and the paid amount meets or exceeds the total, When the user clicks "Konfirmasi", Then the order is created and the receipt dialog opens
- **AC-010**: Given a non-CASH payment method is selected, When the user clicks "Konfirmasi", Then no paid amount input is required and the order is created immediately
- **AC-011**: Given the user is offline, When they complete a POS transaction, Then the order is saved to the mutation queue with a temp ID, a success toast shows "Transaksi disimpan offline...", and the receipt displays using cart data
- **AC-012**: Given the user is online, When a POS transaction succeeds, Then the `SalesOrder` response is displayed in the receipt with the real order ID
- **AC-013**: Given the receipt dialog is open, When the user clicks "Cetak Struk", Then `window.print()` is triggered with print-optimized CSS
- **AC-014**: Given the receipt dialog is open, When the user clicks "Transaksi Baru", Then the cart is cleared, state is reset, and the receipt dialog closes
- **AC-015**: Given queued mutations exist, When the browser goes online, Then `processMutationQueue` is triggered automatically
- **AC-016**: Given a conflict exists in the mutation queue, When the user clicks the `SyncStatusBadge`, Then the `ConflictDialog` opens showing conflict details with retry/discard actions
- **AC-017**: Given the user selects "Tamu" as customer, When no guest name is provided, Then `guestName` defaults to "Tamu" in the order payload

## 6. Test Automation Strategy

### 6.1 Test Levels

| Level | Scope | Priority |
|-------|-------|----------|
| Unit | `usePosCart` (reducer actions: add, remove, update quantity, clear, subtotal computation) | High |
| Unit | `useVariantLookup` (online API call, offline IndexedDB fallback, null result) | High |
| Unit | `useOfflineVariants` (online API priority, IndexedDB fallback, pagination, offline detection) | High |
| Integration | `PosProductSearch` (search input triggers API, barcode scanning, add-to-cart callback) | Medium |
| Integration | `PosPaymentDialog` (method selection, cash validation, confirm disabled states) | Medium |
| Integration | `PosReceipt` (online order data vs offline pending items, print trigger) | Medium |
| E2E | Full POS flow: search → add to cart → checkout → pay → receipt → new transaction | Medium |

### 6.2 Frameworks

- **Frontend unit/integration**: Vitest + `@testing-library/react` + `renderHook`
- **E2E**: Playwright (if applicable)

### 6.3 Coverage Requirements

- Cover all `cartReducer` action types including edge cases (quantity ≤ 0, duplicate add)
- Cover `useVariantLookup` online and offline paths
- Cover `useOfflineVariants` with and without `orgFilter`, with and without cached data
- Cover `PosPaymentDialog` for all four payment methods and cash validation states

## 7. Rationale & Context

### Why Frontend-Only Module?

POS does not have dedicated backend files because it reuses the existing `sales-orders` backend module. A POS transaction is simply a sales order created with a specific set of fields (warehouse, customer/guest, items, payment method). This avoids API duplication and ensures consistency between POS orders and manually created sales orders in the admin panel.

### Why useReducer for Cart State?

`useReducer` was chosen over `useState` for cart state because the cart has multiple interdependent state transitions (add, remove, update quantity, clear). A reducer provides a single source of truth for state transitions, making the logic easier to test (pure function) and reason about. The reducer pattern also scales cleanly if new actions (e.g., discount, apply coupon) are added later.

### Why 200ms Barcode Buffer?

Barcode scanners emulate keyboard input by rapidly firing individual key events followed by `Enter`. Human typing is typically slower than 200ms between keystrokes. The buffer accumulates characters and resets after 200ms of inactivity, distinguishing scanner input from manual typing. When `Enter` is detected, the buffer is treated as a complete barcode/SKU.

### Why Ephemeral Cart (No Persistence)?

The cart is intentionally not persisted to IndexedDB or localStorage. POS is a high-turnover workflow — cashiers complete transactions quickly and start fresh. Persisting cart state could cause confusion if a previous session's items reappear. If persistence becomes a requirement, cart state could be added to the Dexie schema in a future version.

### Why Offline-First for POS?

Retail stores frequently experience network outages. Cashiers must be able to continue selling uninterrupted. The offline-first architecture ensures:
1. Product search works from local IndexedDB cache.
2. Orders are queued locally and synced when connectivity returns.
3. New sales orders (create) have zero conflict risk since each gets a unique server ID.

### Why Four Payment Methods?

The four methods (CASH, QRIS, TRANSFER, CARD) cover the most common Indonesian payment methods. QRIS (Quick Response Code Indonesian Standard) is a ubiquitous QR-based payment standard in Indonesia. The set can be extended by updating the `PAYMENT_METHODS` array and the `PaymentMethod` type union.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: **Sales Orders API** (`POST /sales-orders`) — The backend endpoint that POS calls to create sales orders. Defined in `packages/backend/src/modules/sales-orders/sales-orders.route.ts`.

### Third-Party Services

- **SVC-001**: **better-auth** — Provides the active organization ID used for IndexedDB scoping in `useOfflineVariants`
- **SVC-002**: **Dexie.js** — IndexedDB wrapper for offline variant data and mutation queue storage

### Infrastructure Dependencies

- **INF-001**: **IndexedDB API** — Local data store for offline product variants and mutation queue
- **INF-002**: **Navigator.onLine / online/offline events** — Browser connectivity detection for triggering online/offline transitions and sync

### Data Dependencies

- **DAT-001**: **Variants** — Product variants with SKU, price, stock, and product name. Fetched from `GET /variants` or read from IndexedDB `variants` table
- **DAT-002**: **Warehouses** — Warehouse list for checkout panel selection. Fetched from `GET /warehouses` via `useWarehouses` hook
- **DAT-003**: **Customers** — Customer list for checkout panel selection. Fetched from `GET /customers` via `useCustomers` hook
- **DAT-004**: **Sales Orders** — Created via `POST /sales-orders`. Types imported from `backend/src/modules/sales-orders/sales-orders.route.ts`
- **DAT-005**: **Mutation Queue** — IndexedDB table storing offline mutations. Managed by `mutation-queue.ts`
- **DAT-006**: **Sync Pipeline** — Background sync for delta data and mutation processing. Managed by `sync.ts`

### Technology Platform Dependencies

- **PLT-001**: **React 19** — UI framework
- **PLT-002**: **TanStack Query** — Server-state cache layer with query invalidation
- **PLT-003**: **TanStack Router** — File-based routing for the POS page
- **PLT-004**: **Dexie.js 4.x** — IndexedDB wrapper (`dexie`, `dexie-react-hooks`)
- **PLT-005**: **shadcn/ui + Radix** — UI component primitives (Dialog, Button, Input, Select)
- **PLT-006**: **Lucide React** — Icon library
- **PLT-007**: **Sonner** — Toast notifications
- **PLT-008**: **Eden Treaty** — Type-safe API client for backend communication

## 9. Examples & Edge Cases

### 9.1 Complete POS Transaction Flow (Online)

```
1. Cashier opens POS page (/_dashboard/pos)
   → useWarehouses and useCustomers fetch reference data
   → First warehouse auto-selected

2. Cashier scans a product barcode
   → handleBarcodeKey accumulates keystrokes in barcodeBuffer
   → Enter pressed → buffer contents used as SKU
   → useVariantLookup calls api.variants.lookup.get({ query: { sku } })
   → Variant found → addItem(variant) → cart updated
   → Search input cleared

3. Cashier adds more products via search or barcode
   → useOfflineVariants fetches from API (online)
   → Grid shows products with cart quantity badges
   → Clicking product → addItem(variant)

4. Cashier adjusts quantities
   → PosCart renders +/- buttons per item
   → onUpdateQuantity dispatched → reducer updates state

5. Cashier configures transaction settings
   → Clicks settings icon → Dialog opens
   → Selects warehouse (already defaulted)
   → Selects customer or leaves as "Tamu"
   → Closes dialog

6. Cashier clicks "Bayar"
   → handleCheckout stores warehouse/customer data, opens payment dialog

7. Cashier selects "Tunai" (CASH), enters amount
   → Quick-amount buttons help with common denominations
   → Change calculated and displayed
   → Clicks "Konfirmasi"

8. Order created online
   → createOrder.mutateAsync sends POST /sales-orders
   → Server returns SalesOrder with real ID
   → Cache invalidated for sales-orders, variants, audit-logs
   → Receipt dialog opens with order data
   → Toast: "Transaksi berhasil!"
```

### 9.2 Complete POS Transaction Flow (Offline)

```
1. Cashier is offline (network disconnected)
   → SyncStatusBadge shows offline state

2. Cashier scans a product barcode
   → useVariantLookup detects navigator.onLine === false
   → Falls back to db.variants.where('sku').equals(sku).first()
   → Looks up product name from db.products
   → Variant found → addItem(variant)

3. Cashier searches for products
   → useOfflineVariants: API query disabled (navigator.onLine)
   → useLiveQuery reads from IndexedDB variants table
   → Filters by organizationId, search term, isActive, !deletedAt
   → Results displayed in grid

4. Cashier completes checkout
   → Payment dialog shows offline warning banner
   → Selects payment method, confirms

5. Order created offline
   → useOfflineMutation detects offline
   → enqueueMutation stores in mutationQueue:
       { tempId: 'offline_<uuid>', model: 'sales-orders',
         operation: 'create', data: {...orderInput} }
   → Returns { tempId, offline: true }
   → POS page constructs OfflineTempOrder object
   → Receipt dialog opens with cart data (pendingItems)
   → Toast: "Transaksi disimpan offline. Akan disinkronkan otomatis."

6. Network reconnects
   → 'online' event fires → createOrder.syncNow()
   → processMutationQueue sends to POST /sync/batch
   → Server creates real sales order, returns serverId
   → Mutation removed from queue
   → TanStack Query caches invalidated
```

### 9.3 Edge Cases

- **Duplicate add**: Adding a variant that is already in the cart increments quantity instead of creating a duplicate entry
- **Zero quantity**: Setting quantity to 0 via `UPDATE_QTY` removes the item (same as `REMOVE_ITEM`)
- **No warehouse loaded**: If `useWarehouses` returns no data (e.g., no warehouses created), the checkout button remains disabled and no warehouse can be selected
- **Barcode buffer expiry**: If a barcode scanner is slow (> 200ms between keystrokes), the buffer resets and the barcode is not recognized as a single scan
- **Guest with no name**: If "Tamu" is selected and the guest name input is empty, `guestName` defaults to "Tamu" in the order payload
- **Network error during online payment**: If `POST /sales-orders` fails with a network error (TypeError), `useOfflineMutation` falls back to offline enqueue instead of throwing
- **Non-network API error**: If the API returns a 4xx/5xx error (e.g., validation failure), the error is thrown to the caller and the payment dialog re-opens with the error message
- **Quick-amount deduplication**: The cash quick-amount buttons filter out duplicate values — e.g., if the total is exactly a multiple of 50,000, only two unique buttons appear
- **Cart with no images**: When products have no images (common when loading from IndexedDB which does not store image data), a placeholder SVG icon is displayed instead
- **Mutation queue processing interruption**: If `processMutationQueue` fails mid-batch, mutations marked as `'syncing'` are reverted to `'pending'` on the next sync cycle

## 10. Validation Criteria

A POS module conforming to this specification must satisfy:

1. **File structure**: `modules/pos/` with `hooks/`, `components/`, and `index.ts`; route at `routes/_dashboard/pos/index.tsx`
2. **No backend files**: No route, service, or test files exist under `packages/backend/src/modules/pos/`
3. **Cart reducer**: All four action types (`ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QTY`, `CLEAR_CART`) work correctly with correct derived values
4. **Offline search**: Product search returns results from IndexedDB when offline and from API when online
5. **Barcode scanning**: SKU lookup triggers on Enter after buffered keystrokes
6. **Payment validation**: CASH payment requires paid amount ≥ total; non-CASH methods confirm without amount input
7. **Offline order creation**: Orders created offline are stored in the mutation queue with temp IDs
8. **Receipt display**: Online receipts show API data; offline receipts show cart-derived data
9. **Conflict resolution**: `SyncStatusBadge` and `ConflictDialog` are integrated and functional
10. **Auto-sync on reconnect**: `online` event triggers `processMutationQueue`
11. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
12. **IDR formatting**: All monetary amounts formatted with `id-ID` locale
13. **Responsive layout**: Two-column on desktop, stacked on mobile with appropriate breakpoints

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- [Sales Orders Module](../sales-orders/spec-v1.md) — Backend API that POS consumes for order creation (`POST /sales-orders`)
- [Products Module](../products/spec-v1.md) — Products, variants, and categories that POS displays in search
- [Offline-First Architecture](../offline-first/spec-v1.md) — Dexie, mutation queue, sync pipeline, Service Worker architecture
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Offline mutation hook: `packages/frontend/src/hooks/use-offline-mutation.ts`
- Mutation queue: `packages/frontend/src/lib/mutation-queue.ts`
- Sync pipeline: `packages/frontend/src/lib/sync.ts`
- Dexie database: `packages/frontend/src/lib/db.ts`
- SyncStatusBadge component: `packages/frontend/src/components/ui/sync-status-badge.tsx`
- ConflictDialog component: `packages/frontend/src/components/ui/conflict-dialog.tsx`
- Sales orders route: `packages/backend/src/modules/sales-orders/sales-orders.route.ts`
