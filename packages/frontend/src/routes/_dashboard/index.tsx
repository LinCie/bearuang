import { createFileRoute, Link } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'
import {
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  ClipboardList,
  Sparkles,
} from 'lucide-react'
import {
  useDashboardSummary,
  useDashboardRecentOrders,
  formatRupiah,
  statusLabel,
  statusColor,
} from '@/modules/dashboard'
import type { RecentOrder } from '@/modules/dashboard'

export const Route = createFileRoute('/_dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: sessionData } = useSession()
  const userName = sessionData?.user.name || 'User'
  const firstName = userName.split(' ')[0]

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary()
  const { data: recentOrders, isLoading: ordersLoading } =
    useDashboardRecentOrders()

  // Group orders by "today" vs "older"
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayOrders: RecentOrder[] = []
  const olderOrders: RecentOrder[] = []

  for (const order of recentOrders ?? []) {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    if (orderDate.getTime() >= today.getTime()) {
      todayOrders.push(order)
    } else {
      olderOrders.push(order)
    }
  }

  const greeting = getGreeting()

  return (
    <>
      {/* Welcome Header */}
      <header className="mb-14">
        <h2 className="text-2xl font-medium text-foreground mb-1">
          {greeting}, {firstName}.
        </h2>
        <p className="text-muted-foreground">Ringkasan aktivitas hari ini.</p>
      </header>

      {/* Summary Metrics - Asymmetric Rhythm */}
      <section className="mb-24 flex flex-col md:flex-row gap-12 md:gap-24 items-start">
        {/* Primary financial grouping */}
        <div className="flex flex-col sm:flex-row gap-10 sm:gap-20">
          <div>
            <p className="text-muted-foreground text-sm mb-2">
              Total Penjualan
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              {summaryLoading ? (
                <SkeletonMetric size="xl" />
              ) : (
                <span className="text-5xl font-medium text-foreground tracking-tight">
                  {formatCompactRupiah(summary?.weeklySales ?? 0)}
                </span>
              )}
              <span className="text-sm font-medium text-primary/80 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" aria-hidden="true" />
                Minggu ini
              </span>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm mb-2">
              Pendapatan Bulanan
            </p>
            {summaryLoading ? (
              <SkeletonMetric size="lg" className="mt-3" />
            ) : (
              <span className="text-3xl font-medium text-foreground/90 tracking-tight block mt-3">
                {formatCompactRupiah(summary?.monthlyRevenue ?? 0)}
              </span>
            )}
          </div>
        </div>

        {/* Secondary operational grouping */}
        <div className="flex flex-col sm:flex-row gap-10 sm:gap-16 md:ml-auto md:pt-4">
          <div>
            <p className="text-destructive/80 text-sm mb-1.5 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" /> Perlu
              Tindakan
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              {summaryLoading ? (
                <SkeletonMetric size="md" />
              ) : (
                <>
                  <span className="text-2xl font-medium text-foreground tracking-tight">
                    {summary?.pendingPickup ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground/90">
                    menunggu pengambilan
                  </span>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm mb-1.5">
              Pelanggan Aktif
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              {summaryLoading ? (
                <SkeletonMetric size="md" />
              ) : (
                <>
                  <span className="text-2xl font-medium text-foreground tracking-tight">
                    {summary?.activeCustomers ?? 0}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Dashboard Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Recent Activity */}
        <div className="lg:col-span-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">
              Aktivitas Terbaru
            </h3>
            <Link
              to="/sales-orders"
              className="text-sm text-primary/80 hover:text-primary transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
            >
              Lihat semua{' '}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {ordersLoading ? (
            <LoadingOrders />
          ) : !recentOrders || recentOrders.length === 0 ? (
            <EmptyOrders />
          ) : (
            <div className="flex flex-col gap-10">
              {/* Today Group */}
              {todayOrders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest mb-4">
                    Hari Ini
                  </p>
                  <div className="flex flex-col gap-6">
                    {todayOrders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}

              {/* Older Group */}
              {olderOrders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest mb-4">
                    Sebelumnya
                  </p>
                  <div className="flex flex-col gap-6">
                    {olderOrders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Column */}
        <div className="lg:col-span-4 flex flex-col gap-10 pt-1 lg:pt-0">
          {/* Action Required */}
          <div>
            <h3 className="text-xs font-semibold text-secondary-foreground uppercase tracking-widest mb-3">
              Perlu Tindakan
            </h3>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
              {(summary?.pendingPickup ?? 0) > 0
                ? `Anda memiliki ${summary?.pendingPickup} pesanan yang menunggu pengambilan. Pastikan untuk memproses pengiriman secepatnya.`
                : 'Semua pesanan sudah diproses. Tidak ada tindakan yang diperlukan saat ini.'}
            </p>
            <Link
              to="/sales-orders"
              search={{ status: 'SHIPPED' }}
              className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors focus-visible:outline-none rounded"
            >
              Kelola Pesanan →
            </Link>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground/80 uppercase tracking-widest mb-4">
              Sorotan Cepat
            </h3>
            <ul className="flex flex-col gap-4">
              <li>
                <button className="group flex flex-col items-start text-left focus-visible:outline-none rounded">
                  <span className="text-foreground text-sm font-medium group-hover:text-primary transition-colors">
                    Laporan Pajak Q1
                  </span>
                  <span className="text-sm text-muted-foreground/80 mt-0.5">
                    Akuntansi siap ditinjau
                  </span>
                </button>
              </li>
              <li>
                <div className="flex flex-col items-start text-left">
                  <span className="text-foreground text-sm font-medium">
                    {summary?.activeCustomers ?? 0} Pelanggan Aktif
                  </span>
                  <span className="text-sm text-muted-foreground/80 mt-0.5">
                    {formatCompactRupiah(summary?.monthlyRevenue ?? 0)} bulan
                    ini
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function OrderRow({ order }: { order: RecentOrder }) {
  return (
    <div className="group flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
      <div>
        <p className="font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer">
          {order.customerName}
        </p>
        <p className="text-sm text-muted-foreground/80">
          {order.firstItemName}
        </p>
      </div>
      <div className="flex items-baseline gap-6 sm:w-1/3 justify-between sm:justify-end">
        <span className={`text-sm tracking-wide ${statusColor(order.status)}`}>
          {statusLabel(order.status)}
        </span>
        <span className="text-foreground tabular-nums">
          {formatRupiah(order.totalPrice)}
        </span>
      </div>
    </div>
  )
}

function SkeletonMetric({
  size = 'md',
  className = '',
}: {
  size?: 'xl' | 'lg' | 'md'
  className?: string
}) {
  const heights = { xl: 'h-12 w-36', lg: 'h-9 w-28', md: 'h-7 w-20' }
  return (
    <div
      className={`${heights[size]} rounded-md bg-muted animate-pulse ${className}`}
    />
  )
}

function LoadingOrders() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2"
        >
          <div>
            <div className="h-4 w-32 bg-muted rounded mb-2" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
          <div className="flex items-baseline gap-6 sm:w-1/3 justify-between sm:justify-end">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
          <ClipboardList className="h-7 w-7 text-amber-500" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        Belum ada pesanan <Sparkles className="inline h-4 w-4 text-amber-500" />
      </h3>
      <p className="text-sm text-muted-foreground max-w-[300px]">
        Aktivitas penjualan akan muncul di sini setelah Anda membuat pesanan
        pertama.
      </p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 19) return 'Selamat sore'
  return 'Selamat malam'
}

function formatCompactRupiah(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp${(amount / 1_000_000_000).toFixed(1)}m`
  }
  if (amount >= 1_000_000) {
    return `Rp${(amount / 1_000_000).toFixed(1)}jt`
  }
  if (amount >= 1_000) {
    return `Rp${(amount / 1_000).toFixed(0)}rb`
  }
  return formatRupiah(amount)
}
