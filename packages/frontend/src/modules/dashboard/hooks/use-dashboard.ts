import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────

export interface DashboardSummary {
  weeklySales: number
  monthlyRevenue: number
  pendingPickup: number
  activeCustomers: number
}

export interface RecentOrder {
  id: string
  customerName: string
  firstItemName: string
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
  totalPrice: number
  createdAt: string
}

export type OrdersPreset = 'today' | 'this-week' | 'this-month'
export type OrdersVerdict = 'great' | 'normal' | 'slow'
export type StockVerdict = 'healthy' | 'running-low' | 'critical' | 'normal'

export interface OrdersReport {
  preset: string
  verdict: OrdersVerdict
  currentRevenue: number
  previousRevenue: number
  changePercent: number
  orderCount: number
  previousOrderCount: number
}

export interface StockReportItem {
  variantId: string
  variantName: string
  productName: string
  stock: number
}

export interface StockReport {
  verdict: StockVerdict
  totalVariants: number
  outOfStockCount: number
  lowStockCount: number
  lowStockPercentage: number
  topItems: StockReportItem[]
}

// ─── Query Keys ──────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  recentOrders: () => [...dashboardKeys.all, 'recentOrders'] as const,
  ordersReport: (preset: OrdersPreset) =>
    [...dashboardKeys.all, 'ordersReport', preset] as const,
  stockReport: () => [...dashboardKeys.all, 'stockReport'] as const,
}

// ─── Helpers ─────────────────────────────────────────────────

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function statusLabel(status: RecentOrder['status']): string {
  const labels: Record<RecentOrder['status'], string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Dikonfirmasi',
    SHIPPED: 'Dikirim',
    DELIVERED: 'Diterima',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
  }
  return labels[status]
}

export function statusColor(status: RecentOrder['status']): string {
  const colors: Record<RecentOrder['status'], string> = {
    PENDING: 'text-muted-foreground',
    CONFIRMED: 'text-blue-600 dark:text-blue-400',
    SHIPPED: 'text-amber-600 dark:text-amber-400',
    DELIVERED: 'text-emerald-600 dark:text-emerald-400',
    COMPLETED: 'text-primary',
    CANCELLED: 'text-destructive',
  }
  return colors[status]
}

export function verdictLabel(verdict: OrdersVerdict | StockVerdict): string {
  const labels: Record<string, string> = {
    great: 'Bagus',
    normal: 'Normal',
    slow: 'Lambat',
    healthy: 'Sehat',
    'running-low': 'Menipis',
    critical: 'Kritis',
  }
  return labels[verdict] ?? verdict
}

export function presetLabel(preset: OrdersPreset): string {
  const labels: Record<OrdersPreset, string> = {
    today: 'Hari Ini',
    'this-week': 'Minggu Ini',
    'this-month': 'Bulan Ini',
  }
  return labels[preset]
}

// ─── Queries ─────────────────────────────────────────────────

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data, error } = await api.dashboard.summary.get()
      if (error) throw error
      return data as DashboardSummary
    },
  })
}

export function useDashboardRecentOrders() {
  return useQuery({
    queryKey: dashboardKeys.recentOrders(),
    queryFn: async () => {
      const { data, error } = await api['dashboard']['recent-orders'].get()
      if (error) throw error
      return data as RecentOrder[]
    },
  })
}

export function useOrdersReport(preset: OrdersPreset = 'today') {
  return useQuery({
    queryKey: dashboardKeys.ordersReport(preset),
    queryFn: async () => {
      const { data, error } = await api.dashboard.reports.orders.get({
        query: { preset },
      })
      if (error) throw error
      return data as OrdersReport
    },
  })
}

export function useStockReport() {
  return useQuery({
    queryKey: dashboardKeys.stockReport(),
    queryFn: async () => {
      const { data, error } = await api.dashboard.reports.stock.get()
      if (error) throw error
      return data as StockReport
    },
  })
}
