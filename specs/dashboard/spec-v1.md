---
title: Dashboard Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: dashboard
tags: [dashboard, summary, verdict, analytics, read-only, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the dashboard domain in BearUang. The dashboard is a **read-only aggregation module** that surfaces key business metrics (weekly sales, monthly revenue, pending pickups, active customers), recent order activity, and two verdict-driven reports (orders performance and stock health). It has no mutations, no audit logging, and no database models of its own — all data is derived from the sales orders, stock movements, product variants, and customers modules.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, and aggregation queries
- **Frontend module structure**: TanStack Query hooks, shared types, helper functions, and the dashboard page
- **API contracts**: HTTP endpoints (all GET), request/response schemas, verdict computation logic
- **Verdict system**: Business rules for orders verdict (`great`, `normal`, `slow`) and stock verdict (`healthy`, `running-low`, `critical`, `normal`)
- **VerdictCard component**: Reusable UI primitive for verdict-driven alert cards with visual feedback
- **Data source dependencies**: Which modules provide the data the dashboard aggregates

**Audience**: Developers maintaining or extending the dashboard, building new verdict-driven features, or adding new summary metrics.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Verdict** | A computed label (`great`/`normal`/`slow` for orders; `healthy`/`running-low`/`critical`/`normal` for stock) that summarizes the health of a business metric with visual styling |
| **Preset** | A time-range selector (`today`, `this-week`, `this-month`) used by the orders report to compare current vs previous period |
| **VerdictCard** | A React component that renders a bordered card with a left-border color mapped to the verdict severity |
| **Summary Metrics** | The four top-level KPIs displayed on the dashboard: weekly sales, monthly revenue, pending pickup count, and active customer count |
| **Recent Orders** | The 5 most recent sales orders returned with customer name, first item name, status, and total price |
| **Stock Health** | An analysis of variant stock levels across the organization, counting out-of-stock and low-stock variants with a percentage threshold for the verdict |
| **Revenue** | Sum of `quantity * unitPrice` across order items, filtered to `COMPLETED` or `DELIVERED` orders only |
| **Pending Pickup** | Count of orders with status `SHIPPED` (shipped but awaiting customer pickup/delivery) |
| **Compact Rupiah** | A frontend formatting function that abbreviates large IDR values (e.g., `Rp1.5m`, `Rp820rb`) |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The dashboard module resides in `packages/backend/src/modules/dashboard/` with a `.route.ts` and `.service.ts` file
- **REQ-002**: The route plugin is an Elysia instance with `{ prefix: '/dashboard', tags: ['Dashboard'] }`
- **REQ-003**: The route plugin must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: No `requirePermission` is declared — dashboard access is organization-scoped but not permission-gated (any authenticated org member can view)
- **REQ-006**: Zod schemas define response shapes for all endpoints
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: All Prisma queries are scoped by `organizationId`; soft-deleted records (`deletedAt: null`) are filtered for stock queries
- **REQ-009**: All endpoints are read-only (GET only) — no mutations, no audit logging
- **REQ-010**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint

### 3.2 Service Layer

- **REQ-011**: The service is exported as an object literal: `export const dashboardService = { async method() {...} }`
- **REQ-012**: Revenue calculations only include orders with status `COMPLETED` or `DELIVERED`
- **REQ-013**: Pending pickup counts orders with status `SHIPPED`
- **REQ-014**: Weekly sales use Monday as the start of the week (`getWeekStartMonday()`)
- **REQ-015**: The orders report compares the current period against an equivalent-length previous period using `getDateRange(preset)`
- **REQ-016**: The stock report queries variants where both the variant and its parent product are not soft-deleted (`deletedAt: null`)
- **REQ-017**: Low stock is defined as `stock > 0 && stock <= 5`; out-of-stock is `stock === 0`
- **REQ-018**: Stock verdict thresholds: `healthy` when low-stock percentage < 10%, `running-low` when <= 25%, `critical` when > 25%

### 3.3 Frontend Architecture

- **REQ-019**: The frontend module resides in `packages/frontend/src/modules/dashboard/` with `hooks/` and `index.ts`
- **REQ-020**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-dashboard.ts`
- **REQ-021**: Query key factory is defined in `hooks/use-dashboard.ts` as the `dashboardKeys` object
- **REQ-022**: No mutation hooks exist — the dashboard is entirely read-only
- **REQ-023**: Shared types (`DashboardSummary`, `RecentOrder`, `OrdersReport`, `StockReport`, `OrdersPreset`, `OrdersVerdict`, `StockVerdict`) are exported from the hooks file
- **REQ-024**: Helper functions (`formatRupiah`, `statusLabel`, `statusColor`, `verdictLabel`, `presetLabel`) are co-located with hooks
- **REQ-025**: The dashboard page renders at `/_dashboard/` (`routes/_dashboard/index.tsx`)
- **REQ-026**: The page uses time-of-day greeting (`Selamat pagi/siang/sore/malam`) with the user's first name
- **REQ-027**: Recent orders are split into "Hari Ini" and "Sebelumnya" groups based on creation date
- **REQ-028**: The stock verdict card supports an expandable detail list of the top 5 lowest-stock variants
- **REQ-029**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-030**: Currency formatted as IDR using `formatRupiah`; compact display uses `formatCompactRupiah` for abbreviated values

### 3.4 Verdict System

- **REQ-031**: Orders verdict is computed by `computeOrdersVerdict()` based on current hour, order count, current revenue, previous revenue, and change percent
- **REQ-032**: Orders verdict rules: before 10:00 AM with zero orders = `normal`; zero orders after 10:00 = `slow`; previousRevenue zero with currentRevenue > 0 = `great`; changePercent > 10% = `great`; changePercent < -30% = `slow`; otherwise = `normal`
- **REQ-033**: Stock verdict is computed based on low-stock percentage thresholds relative to total variant count
- **REQ-034**: `VerdictCard` component maps verdicts to left-border colors: `great`/`healthy` = emerald, `normal` = muted, `slow`/`critical` = red, `running-low` = amber
- **REQ-035**: `VerdictCard` renders a skeleton loading state (three animated pulse bars) when `loading` is true

### 3.5 Constraints

- **CON-001**: Dashboard endpoints do not require specific permissions — any authenticated organization member can access them
- **CON-002**: The dashboard has no database models of its own; all data is aggregated at query time from other modules
- **CON-003**: Revenue is computed from order item `unitPrice` (Decimal serialized to number via `.toNumber()`)
- **CON-004**: The stock report's "low stock" threshold (5 units) is hardcoded in the service, not configurable
- **CON-005**: Recent orders limit is fixed at 5 records (`take: 5`)
- **CON-006**: Stock report top items limit is fixed at 5 variants (`take: 5`)
- **CON-007**: Change percent in orders report is rounded to one decimal place (`Math.round(x * 10) / 10`)
- **CON-008**: The "this-month" preset's previous period is capped at the number of days elapsed in the current month to avoid unfair comparison with full months

### 3.6 Guidelines

- **GUD-001**: The `dashboardKeys` query key factory should be extended with new keys if additional dashboard endpoints are added (e.g., `dashboardKeys.newReport(preset)`)
- **GUD-002**: Helper functions like `formatRupiah`, `statusLabel`, and `verdictLabel` are intentionally co-located with hooks since they are dashboard-specific presentational helpers
- **GUD-003**: If new verdict levels are added (e.g., `warning`), both the backend Zod schema, the service computation logic, and the `VerdictCard` border mapping must be updated together
- **GUD-004**: Consider adding `staleTime` to dashboard queries if real-time accuracy is less critical than reducing API load
- **GUD-005**: The `VerdictCard` component is generic enough to be reused by other verdict-driven features beyond the dashboard

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/dashboard/summary` | Get dashboard summary metrics (weekly sales, monthly revenue, pending pickup, active customers) | Auth + Org | `SummaryResponse` |
| GET | `/dashboard/recent-orders` | Get the 5 most recent sales orders with customer name, first item name, status, and total price | Auth + Org | `RecentOrder[]` |
| GET | `/dashboard/reports/orders?preset=today` | Get orders revenue report with verdict comparing current vs previous period | Auth + Org | `OrdersReport` |
| GET | `/dashboard/reports/stock` | Get stock health report with verdict and top 5 lowest-stock variants | Auth + Org | `StockReport` |

### 4.2 Query Parameters

```typescript
interface OrdersReportQuery {
  preset: 'today' | 'this-week' | 'this-month'; // default: 'today'
}
```

No query parameters are accepted by `/dashboard/summary`, `/dashboard/recent-orders`, or `/dashboard/reports/stock`.

### 4.3 Response Shapes

```typescript
interface SummaryResponse {
  weeklySales: number;       // Total revenue from COMPLETED/DELIVERED orders since Monday
  monthlyRevenue: number;    // Total revenue from COMPLETED/DELIVERED orders since the 1st of the month
  pendingPickup: number;     // Count of SHIPPED orders awaiting delivery
  activeCustomers: number;   // Count of customers with isActive = true
}

interface RecentOrder {
  id: string;
  customerName: string;      // Customer name, guest name, or 'Tanpa Nama'
  firstItemName: string;     // Name of the first order item's variant, or '-'
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  totalPrice: number;        // Sum of quantity * unitPrice for all items
  createdAt: string;         // ISO 8601 datetime string
}

interface OrdersReport {
  preset: string;                // The requested preset value
  verdict: 'great' | 'normal' | 'slow';
  currentRevenue: number;        // Revenue for the current period
  previousRevenue: number;       // Revenue for the equivalent previous period
  changePercent: number;         // Percentage change (rounded to 1 decimal); 100 when previous was 0 and current > 0
  orderCount: number;            // Total (non-cancelled) orders in the current period
  previousOrderCount: number;    // Total (non-cancelled) orders in the previous period
}

interface StockReportItem {
  variantId: string;
  variantName: string;
  productName: string;
  stock: number;
}

interface StockReport {
  verdict: 'healthy' | 'running-low' | 'critical' | 'normal';
  totalVariants: number;          // Total active (non-deleted) variants in the organization
  outOfStockCount: number;        // Variants with stock === 0
  lowStockCount: number;          // Variants with stock > 0 && stock <= 5
  lowStockPercentage: number;     // ((outOfStockCount + lowStockCount) / totalVariants) * 100, rounded to 1 decimal
  topItems: StockReportItem[];    // Top 5 variants with lowest stock (stock <= 5), ordered ascending
}
```

### 4.4 Zod Schema Definitions

```typescript
const summarySchema = z.object({
  weeklySales: z.number(),
  monthlyRevenue: z.number(),
  pendingPickup: z.number().int(),
  activeCustomers: z.number().int(),
});

const recentOrderSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  firstItemName: z.string(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ]),
  totalPrice: z.number(),
  createdAt: z.iso.datetime(),
});

const recentOrdersResponseSchema = z.array(recentOrderSchema);

const ordersPresetSchema = z.enum(['today', 'this-week', 'this-month']);

const ordersReportSchema = z.object({
  preset: z.string(),
  verdict: z.enum(['great', 'normal', 'slow']),
  currentRevenue: z.number(),
  previousRevenue: z.number(),
  changePercent: z.number(),
  orderCount: z.number().int(),
  previousOrderCount: z.number().int(),
});

const stockReportItemSchema = z.object({
  variantId: z.string(),
  variantName: z.string(),
  productName: z.string(),
  stock: z.number().int(),
});

const stockReportSchema = z.object({
  verdict: z.enum(['healthy', 'running-low', 'critical', 'normal']),
  totalVariants: z.number().int(),
  outOfStockCount: z.number().int(),
  lowStockCount: z.number().int(),
  lowStockPercentage: z.number(),
  topItems: z.array(stockReportItemSchema),
});
```

### 4.5 Backend Verdict Computation Logic

#### Orders Verdict (`computeOrdersVerdict`)

```typescript
type OrdersVerdict = 'great' | 'normal' | 'slow';

function computeOrdersVerdict(
  currentRevenue: number,
  previousRevenue: number,
  changePercent: number,
  orderCount: number,
): OrdersVerdict {
  const hour = new Date().getHours();
  // Before 10 AM, zero orders is normal (day just started)
  if (hour < 10 && orderCount === 0) return 'normal';
  // After 10 AM, zero orders is concerning
  if (orderCount === 0) return 'slow';
  // First-ever revenue is great news
  if (previousRevenue === 0 && currentRevenue > 0) return 'great';
  // No revenue in either period
  if (previousRevenue === 0 && currentRevenue === 0) return 'normal';
  // Revenue grew more than 10%
  if (changePercent > 10) return 'great';
  // Revenue dropped more than 30%
  if (changePercent < -30) return 'slow';
  // Anything else is normal
  return 'normal';
}
```

#### Stock Verdict

```typescript
type StockVerdict = 'healthy' | 'running-low' | 'critical' | 'normal';

// Computed from lowStockPercentage:
//   totalVariants === 0  -> 'normal'  (no data to assess)
//   lowStockPercentage < 10  -> 'healthy'
//   lowStockPercentage <= 25  -> 'running-low'
//   lowStockPercentage > 25  -> 'critical'
//
// lowStockPercentage = ((outOfStockCount + lowStockCount) / totalVariants) * 100
```

### 4.6 Backend Date Range Computation (`getDateRange`)

```typescript
type OrdersPreset = 'today' | 'this-week' | 'this-month';

interface DateRange {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
}

function getDateRange(preset: OrdersPreset): DateRange
```

| Preset | Current Period | Previous Period |
|--------|---------------|-----------------|
| `today` | Today 00:00 → now | Yesterday 00:00 → today 00:00 |
| `this-week` | Monday 00:00 → now | Previous Monday 00:00 → this Monday 00:00 |
| `this-month` | 1st of month 00:00 → now | 1st of previous month → equivalent day in previous month (capped at month end) |

### 4.7 Frontend Query Key Factory

```typescript
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  recentOrders: () => [...dashboardKeys.all, 'recentOrders'] as const,
  ordersReport: (preset: OrdersPreset) =>
    [...dashboardKeys.all, 'ordersReport', preset] as const,
  stockReport: () => [...dashboardKeys.all, 'stockReport'] as const,
};
```

### 4.8 Frontend Hooks

```typescript
// Fetches GET /dashboard/summary
export function useDashboardSummary(): UseQueryResult<DashboardSummary>

// Fetches GET /dashboard/recent-orders
export function useDashboardRecentOrders(): UseQueryResult<RecentOrder[]>

// Fetches GET /dashboard/reports/orders?preset={preset}
export function useOrdersReport(preset: OrdersPreset = 'today'): UseQueryResult<OrdersReport>

// Fetches GET /dashboard/reports/stock
export function useStockReport(): UseQueryResult<StockReport>
```

### 4.9 Frontend Helper Functions

```typescript
// Format a number as IDR currency string (e.g., "Rp850.000")
export function formatRupiah(amount: number): string

// Map order status enum to Indonesian label
export function statusLabel(status: RecentOrder['status']): string
// PENDING -> 'Pending', CONFIRMED -> 'Dikonfirmasi', SHIPPED -> 'Dikirim',
// DELIVERED -> 'Diterima', COMPLETED -> 'Selesai', CANCELLED -> 'Dibatalkan'

// Map order status to Tailwind color class
export function statusColor(status: RecentOrder['status']): string

// Map verdict to Indonesian label
export function verdictLabel(verdict: OrdersVerdict | StockVerdict): string
// great -> 'Bagus', normal -> 'Normal', slow -> 'Lambat',
// healthy -> 'Sehat', running-low -> 'Menipis', critical -> 'Kritis'

// Map preset to Indonesian label
export function presetLabel(preset: OrdersPreset): string
// today -> 'Hari Ini', this-week -> 'Minggu Ini', this-month -> 'Bulan Ini'
```

### 4.10 VerdictCard Component

```typescript
interface VerdictCardProps {
  verdict: OrdersVerdict | StockVerdict;
  loading?: boolean;       // default: false; shows skeleton when true
  children: React.ReactNode;
}

export function VerdictCard({ verdict, loading, children }: VerdictCardProps): React.ReactElement
```

**Border color mapping:**

| Verdict | Border Color | Tailwind Class |
|---------|-------------|----------------|
| `great` | Emerald | `border-l-emerald-500` |
| `healthy` | Emerald | `border-l-emerald-500` |
| `normal` | Muted foreground | `border-l-muted-foreground/30` |
| `slow` | Red | `border-l-red-500` |
| `running-low` | Amber | `border-l-amber-500` |
| `critical` | Red | `border-l-red-500` |

**Loading state:** When `loading` is true, renders three animated pulse bars (heights: `h-4 w-24`, `h-8 w-40`, `h-3 w-32`) and uses `border-l-muted` instead of the verdict color.

### 4.11 Frontend Route Structure

```
_dashboard/
  index.tsx                    # Dashboard page (summary, verdicts, recent orders, action items)
```

### 4.12 Frontend Module Structure

```
modules/dashboard/
  index.ts                     # Barrel export: re-exports from ./hooks
  hooks/
    index.ts                   # Barrel export: re-exports from ./use-dashboard
    use-dashboard.ts           # Query keys, types, helpers, and all query hooks
components/
  verdict-card.tsx             # Reusable VerdictCard component (shared, not module-scoped)
```

### 4.13 Frontend Page Layout

The dashboard page (`/_dashboard/`) is organized into three visual sections:

1. **Header**: Time-of-day greeting with user's first name; subtitle "Ringkasan aktivitas hari ini."
2. **Verdict Cards** (grid: 1 column on mobile, 2 on medium+):
   - **Orders VerdictCard**: Current revenue, order count, change percent vs previous period, with preset toggle buttons (Hari Ini / Minggu Ini / Bulan Ini)
   - **Stock VerdictCard**: Out-of-stock and low-stock counts, total variants, expandable top 5 lowest-stock items with variant links and "Restok" quick actions
3. **Bottom Section** (grid: 8/4 split on large screens):
   - **Left (8 cols)**: "Aktivitas Terbaru" — recent orders grouped by "Hari Ini" and "Sebelumnya", with status badges, item names, and prices; link to full sales orders list
   - **Right (4 cols)**: "Perlu Tindakan" — action prompt for pending pickups with link to filtered sales orders; "Pelanggan Aktif" count display

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user in an organization, When they `GET /dashboard/summary`, Then they receive `weeklySales`, `monthlyRevenue`, `pendingPickup`, and `activeCustomers` scoped to their organization
- **AC-002**: Given an authenticated user, When they `GET /dashboard/recent-orders`, Then they receive up to 5 recent orders sorted by `createdAt` descending with customer name, first item name, status, and total price
- **AC-003**: Given an authenticated user, When they `GET /dashboard/reports/orders?preset=today`, Then they receive the current day's revenue, previous day's revenue, change percent, order counts, and a verdict
- **AC-004**: Given the orders report `changePercent > 10`, When the verdict is computed, Then it returns `'great'`
- **AC-005**: Given the orders report `changePercent < -30` with orders after 10:00 AM, When the verdict is computed, Then it returns `'slow'`
- **AC-006**: Given the orders report with zero orders before 10:00 AM, When the verdict is computed, Then it returns `'normal'` (early morning grace period)
- **AC-007**: Given an authenticated user, When they `GET /dashboard/reports/stock`, Then they receive stock counts, low-stock percentage, verdict, and up to 5 lowest-stock variant items
- **AC-008**: Given the stock report with `lowStockPercentage < 10`, When the verdict is computed, Then it returns `'healthy'`
- **AC-009**: Given the stock report with `lowStockPercentage > 25`, When the verdict is computed, Then it returns `'critical'`
- **AC-010**: Given an unauthenticated request, When any dashboard endpoint is called, Then a `401 Unauthorized` is returned
- **AC-011**: Given a user without an active organization, When any dashboard endpoint is called, Then a `403 Forbidden` is returned
- **AC-012**: Given the dashboard page in the browser, When the preset toggle is clicked, Then the orders report refetches with the new preset and the VerdictCard updates
- **AC-013**: Given the stock VerdictCard with low-stock items, When "Lihat detail" is clicked, Then the top 5 lowest-stock variants are revealed with links to the variant detail and stock movements
- **AC-014**: Given the dashboard page, When all data is loading, Then skeleton pulse animations are displayed in the VerdictCards and recent orders area
- **AC-015**: Given zero recent orders, When the dashboard loads, Then an empty state is shown with "Belum ada pesanan" message and Sparkles icon
- **AC-016**: Given `pendingPickup > 0`, When the dashboard loads, Then the "Perlu Tindakan" section displays a count-based prompt to manage shipped orders

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service computation functions, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `dashboard.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Key backend test cases**:
  - Summary returns correct metrics for a given organization
  - Recent orders returns at most 5 orders sorted by newest
  - Orders report computes correct date ranges for each preset
  - `computeOrdersVerdict` returns correct verdict for all edge cases (early morning, zero revenue, growth, decline)
  - `sumOrderRevenue` only counts COMPLETED/DELIVERED orders
  - Stock report excludes soft-deleted variants and their parent products
  - Stock verdict thresholds are correctly applied
- **Frontend test cases**:
  - Hooks return data from the correct API endpoints
  - `formatRupiah` formats IDR values correctly
  - `statusLabel` maps all statuses to Indonesian labels
  - `verdictLabel` maps all verdicts to Indonesian labels
  - `VerdictCard` renders loading skeleton when `loading` is true
  - `VerdictCard` applies correct border class for each verdict
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover all computation functions, verdict edge cases, empty states, and loading states

## 7. Rationale & Context

### Why Read-Only Module?
The dashboard is a pure aggregation layer that presents a unified view of data owned by other modules (sales orders, stock, customers). By keeping it read-only with no mutations, audit logging, or own database models, the dashboard avoids introducing coupling or consistency concerns. It simply queries the source of truth.

### Why No Permission Gating?
Dashboard metrics are organization-scoped (every query filters by `organizationId`), and all authenticated organization members benefit from seeing business performance data. There is no sensitive data that requires permission restriction beyond being in the organization.

### Why Verdicts?
Verdicts provide an at-a-glance health assessment that reduces cognitive load. Instead of forcing users to interpret raw numbers and percentages, the verdict system distills the data into actionable labels (`great`, `slow`, `critical`) paired with visual cues (border colors). The time-aware grace period for orders (before 10 AM) prevents false alarms early in the day.

### Why Compact Rupiah Formatting?
Dashboard cards have limited space. Showing `Rp1.500.000.000` is unwieldy; `Rp1.5m` communicates the same magnitude at a glance. The `formatCompactRupiah` function provides tiered abbreviation (miliar, juta, ribu) for amounts above 1,000.

### Why VerdictCard as a Shared Component?
The VerdictCard pattern (border-colored card with loading skeleton) is reusable across any feature that needs to display a verdict. By placing it in `components/` rather than inside the dashboard module, other modules can adopt the same visual language for consistency.

### Why "This Month" Comparison Is Capped?
Comparing the first 15 days of the current month against the full 31 days of the previous month would be unfair. The `getDateRange('this-month')` function caps the previous period to the same number of days elapsed, ensuring an apples-to-apples comparison.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Source of all aggregated data via Prisma ORM (sales orders, variants, customers)

### Data Source Dependencies
- **DAT-001**: **SalesOrder** - Provides weekly sales, monthly revenue, recent orders, pending pickup count, and orders report data
- **DAT-002**: **SalesOrderItem** - Provides line items (quantity, unitPrice) for revenue calculations and first item display
- **DAT-003**: **ProductVariant** - Provides stock levels for the stock health report; filtered by `deletedAt: null`
- **DAT-004**: **Product** - Parent of variants; filtered by `deletedAt: null` to exclude soft-deleted product trees from stock report
- **DAT-005**: **Customer** - Provides active customer count (`isActive: true`)
- **DAT-006**: **Customer (via SalesOrder)** - Provides customer name for recent orders; falls back to `guestName` or `'Tanpa Nama'`

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication and organization membership; provides `authPlugin` with `user` and `organization` context

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer for aggregation queries
- **PLT-003**: **TanStack Query** - Server state management (caching, refetching)
- **PLT-004**: **TanStack Router** - File-based routing with type-safe params
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives
- **PLT-006**: **Lucide React** - Icon library (ArrowRight, ChevronDown, ClipboardList, Sparkles)

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { dashboardService } from './dashboard.service'

export const dashboardRoute = new Elysia({
  prefix: '/dashboard',
  tags: ['Dashboard'],
})
  .use(authPlugin)
  .get(
    '/summary',
    async ({ organization }) => {
      return dashboardService.getSummary(organization.id)
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: { 200: summarySchema },
      detail: {
        summary: 'Get dashboard summary metrics',
        description:
          'Returns weekly sales, monthly revenue, pending pickup count, and active customer count for the authenticated organization.',
      },
    },
  )
```

### 9.2 Backend Service: Revenue Calculation

```typescript
// Revenue only counts COMPLETED or DELIVERED orders
function sumOrderRevenue(
  orders: Array<{
    status: string;
    items: Array<{ quantity: number; unitPrice: { toString: () => string } }>;
  }>,
): number {
  return orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED')
    .reduce(
      (total, order) =>
        total +
        order.items.reduce(
          (sum, item) => sum + item.quantity * Number(item.unitPrice),
          0,
        ),
      0,
    )
}
```

### 9.3 Backend Service: Week Start Calculation

```typescript
// Monday-based week start (ISO week)
function getWeekStartMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
```

### 9.4 Frontend Hook: Orders Report with Preset

```typescript
export function useOrdersReport(preset: OrdersPreset = 'today') {
  return useQuery({
    queryKey: dashboardKeys.ordersReport(preset),
    queryFn: async () => {
      const { data, error } = await api.dashboard.reports.orders.get({
        query: { preset },
      });
      if (error) throw error;
      return data as OrdersReport;
    },
  });
}
```

### 9.5 Frontend: Compact Rupiah Formatting

```typescript
function formatCompactRupiah(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp${(amount / 1_000_000_000).toFixed(1)}m`;
  }
  if (amount >= 1_000_000) {
    return `Rp${(amount / 1_000_000).toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    return `Rp${(amount / 1_000).toFixed(0)}rb`;
  }
  return formatRupiah(amount);
}
```

### 9.6 Edge Cases

- **First-ever order**: When `previousRevenue === 0` and `currentRevenue > 0`, change percent is `100` and verdict is `'great'` — avoids division by zero
- **Zero orders both periods**: When both current and previous revenue are zero, change percent is `0` and verdict is `'normal'` — not alarming when there has never been revenue
- **Early morning with no orders**: Before 10:00 AM, zero orders returns `'normal'` verdict instead of `'slow'` — gives businesses time to receive orders
- **Short month comparison**: When the current month has fewer days than the previous month (e.g., comparing Jan 28 vs Dec 28), the previous period is capped at the previous month's last day
- **Soft-deleted variants in stock report**: The stock report filters both `variant.deletedAt: null` and `product.deletedAt: null` — a variant whose parent product was deleted does not appear in the report
- **Guest orders with no customer**: When a sales order has no linked customer and no `guestName`, the recent orders display falls back to `'Tanpa Nama'`
- **Order with no items**: When an order has zero items, `firstItemName` defaults to `'-'` and `totalPrice` is `0`
- **Zero total variants**: When an organization has no active variants, stock verdict is `'normal'` and `lowStockPercentage` is `0`
- **All variants healthy**: When `lowStockPercentage < 10%`, verdict is `'healthy'` even if some variants have low stock

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/dashboard/` with `.route.ts`, `.service.ts`; frontend has `hooks/` and `index.ts`
2. **Auth & scoping**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`; no `requirePermission`
3. **Read-only**: No POST, PATCH, PUT, or DELETE endpoints; no mutations; no audit logging
4. **Serialization**: All Date fields return ISO 8601 strings; all Decimal fields return numbers
5. **Verdict computation**: Orders verdict follows the time-aware, threshold-based rules; stock verdict follows percentage thresholds
6. **Date ranges**: `getDateRange` produces correct equivalent-length periods for all three presets
7. **Revenue filtering**: Revenue only includes `COMPLETED` and `DELIVERED` orders
8. **Stock filtering**: Stock report excludes soft-deleted variants and their parent products
9. **Frontend query keys**: Hierarchical factory with `all`, `summary()`, `recentOrders()`, `ordersReport(preset)`, `stockReport()`
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **VerdictCard**: Renders correct border color per verdict and shows loading skeleton when `loading` is true
12. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
13. **Preset toggle**: Clicking a preset button refetches the orders report with the new preset
14. **Empty states**: Dashboard renders appropriate empty/loading states when data is unavailable

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Sales orders module: `packages/backend/src/modules/sales-orders/`
- Stock movements module: `packages/backend/src/modules/stock-movements/`
- Products module spec: `specs/products/spec-v1.md`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- VerdictCard component: `packages/frontend/src/components/verdict-card.tsx`
- Dashboard route page: `packages/frontend/src/routes/_dashboard/index.tsx`
