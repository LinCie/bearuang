import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'
import { authClient, useSession } from '@/lib/auth-client'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { TrendingUp, ShoppingBag, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    try {
      const { data: session } = await authClient.getSession()

      if (!session) {
        throw redirect({
          to: '/signin',
          search: {
            redirect: location.href,
          },
        })
      }

      if (!session.session.activeOrganizationId) {
        throw redirect({
          to: '/organizations',
          search: {
            redirect: location.href,
          },
        })
      }
    } catch (error) {
      if (isRedirect(error)) throw error

      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { data: sessionData } = useSession()
  const userName = sessionData?.user?.name || 'User'
  const firstName = userName.split(' ')[0]

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <header className="mb-14">
        <h2 className="text-2xl font-medium text-foreground mb-1">
          Selamat malam, {firstName}.
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
              <span className="text-5xl font-medium text-foreground tracking-tight">
                $12.4k
              </span>
              <span className="text-sm font-medium text-primary/80 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" aria-hidden="true" />
                +8%
              </span>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm mb-2">
              Pendapatan Bulanan
            </p>
            <span className="text-3xl font-medium text-foreground/90 tracking-tight block mt-3">
              $8.9k
            </span>
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
              <span className="text-2xl font-medium text-foreground tracking-tight">
                4
              </span>
              <span className="text-sm text-muted-foreground/90">
                menunggu pengambilan
              </span>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm mb-1.5">
              Pelanggan Aktif
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-medium text-foreground tracking-tight">
                84
              </span>
              <span className="text-xs font-medium text-primary/80">
                +12 bulan ini
              </span>
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
            <button className="text-sm text-primary/80 hover:text-primary transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1">
              Lihat semua{' '}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-10">
            {/* Today Group */}
            <div>
              <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest mb-4">
                Hari Ini
              </p>
              <div className="flex flex-col gap-6">
                {[
                  {
                    id: 1,
                    name: 'Eleanor Miller',
                    item: 'Benih Tomat Heirloom (Grosir)',
                    status: 'Selesai',
                    price: '$142.00',
                    statusColor: 'text-primary',
                  },
                  {
                    id: 2,
                    name: 'Julian Hart',
                    item: 'Stoples Madu Artisan (x4)',
                    status: 'Diproses',
                    price: '$58.50',
                    statusColor: 'text-secondary-foreground',
                  },
                ].map((activity) => (
                  <div
                    key={activity.id}
                    className="group flex flex-col sm:flex-row sm:items-baseline justify-between gap-1"
                  >
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer">
                        {activity.name}
                      </p>
                      <p className="text-sm text-muted-foreground/80">
                        {activity.item}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-6 sm:w-1/3 justify-between sm:justify-end">
                      <span
                        className={`text-sm tracking-wide ${activity.statusColor}`}
                      >
                        {activity.status}
                      </span>
                      <span className="text-foreground tabular-nums">
                        {activity.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Yesterday Group */}
            <div>
              <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-widest mb-4">
                Kemarin
              </p>
              <div className="flex flex-col gap-6">
                {[
                  {
                    id: 3,
                    name: 'Rose Bennett',
                    item: 'Alat Pemintal Wol',
                    status: 'Selesai',
                    price: '$210.00',
                    statusColor: 'text-primary',
                  },
                  {
                    id: 4,
                    name: 'Daniel Stone',
                    item: 'Kit Ranjang Taman Cedar',
                    status: 'Draf',
                    price: '$425.00',
                    statusColor: 'text-muted-foreground',
                  },
                ].map((activity) => (
                  <div
                    key={activity.id}
                    className="group flex flex-col sm:flex-row sm:items-baseline justify-between gap-1"
                  >
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer">
                        {activity.name}
                      </p>
                      <p className="text-sm text-muted-foreground/80">
                        {activity.item}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-6 sm:w-1/3 justify-between sm:justify-end">
                      <span
                        className={`text-sm tracking-wide ${activity.statusColor}`}
                      >
                        {activity.status}
                      </span>
                      <span className="text-foreground tabular-nums">
                        {activity.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="lg:col-span-4 flex flex-col gap-10 pt-1 lg:pt-0">
          {/* Action Required */}
          <div>
            <h3 className="text-xs font-semibold text-secondary-foreground uppercase tracking-widest mb-3">
              Perlu Tindakan
            </h3>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
              Inventaris 15% di bawah rata-rata musiman. Pertimbangkan untuk
              mengisi ulang stok benih dan mulsa organik sebelum masa sibuk awal
              Maret.
            </p>
            <button className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors focus-visible:outline-none rounded">
              Kelola Inventaris →
            </button>
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
                    Cerah, 18°C
                  </span>
                  <span className="text-sm text-muted-foreground/80 mt-0.5">
                    Kondisi optimal untuk menanam
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}
