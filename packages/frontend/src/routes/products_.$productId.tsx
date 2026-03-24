import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { useProduct } from '@/hooks/use-products'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package, PawPrint, AlertCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/products_/$productId')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({ to: '/signin' })
    }
  },
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const { data: product, isLoading, isError } = useProduct(productId)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative flex items-center justify-center h-20 w-20 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-amber-500/15 animate-ping opacity-75 duration-1000" />
            <div className="relative flex items-center justify-center h-full w-full rounded-2xl bg-amber-50 border border-amber-200/50 text-amber-600 shadow-sm transition-transform hover:scale-105">
              <PawPrint className="h-8 w-8 animate-pulse" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-sm font-medium text-amber-800/70 animate-pulse">
            Beruang sedang membongkar catatan produk...
          </p>
        </div>
      </DashboardLayout>
    )
  }

  if (isError || !product) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <div className="flex items-center justify-center h-16 w-16 mb-4 rounded-2xl bg-destructive/10 text-destructive/80">
            <AlertCircle className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <p className="text-destructive/90 text-sm md:text-base text-center max-w-sm px-4 leading-relaxed mb-6">
            Aduh, sepertinya beruang kami kesasar di gudang. Produk ini tidak
            dapat ditemukan saat ini.
          </p>
          <div className="flex items-center gap-3">
            <Link to="/products">
              <Button
                variant="ghost"
                className="hover:bg-muted/50 rounded-full"
              >
                Kembali
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full border-border/50 hover:bg-muted/30 transition-transform active:scale-95"
              onClick={() => window.location.reload()}
            >
              Cari Lagi
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <div className="flex items-start gap-4 lg:gap-5">
          <div className="pt-1.5 shrink-0">
            <Link to="/products">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
                aria-label="Kembali ke Katalog"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight break-words">
              {product.name || 'Produk Tanpa Nama'}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    product.isActive
                      ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                      : 'bg-muted-foreground/40'
                  }`}
                />
                {product.isActive ? 'Tersedia' : 'Diarsipkan'}
              </span>
              <span className="opacity-30">•</span>
              <span>
                Diperbarui{' '}
                {product.updatedAt
                  ? new Intl.DateTimeFormat('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(product.updatedAt))
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col gap-12 lg:pl-14">
          {/* Description (Progressive Disclosure - only if available) */}
          {product.description && (
            <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-w-3xl">
              {product.description}
            </p>
          )}

          {/* Divider */}
          {product.description && <div className="w-full h-px bg-border/20" />}

          {/* Variants Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-foreground">
              Varian ({product.variants?.length || 0})
            </h2>

            <div className="-mx-4 sm:mx-0">
              {!product.variants || product.variants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border/40 rounded-2xl mx-4 sm:mx-0 hover:border-amber-500/30 hover:bg-amber-50/30 transition-colors group cursor-default">
                  <Package
                    className="h-10 w-10 text-muted-foreground/30 mb-3 group-hover:text-amber-500/50 transition-colors group-hover:scale-110 duration-300"
                    strokeWidth={1}
                  />
                  <p className="text-muted-foreground text-sm max-w-[280px] text-center leading-relaxed">
                    Etalase masih kosong. Produk ini belum memajang varian
                    apa-apa.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/30">
                        <TableHead className="font-medium text-muted-foreground/70 w-[20%]">
                          SKU
                        </TableHead>
                        <TableHead className="font-medium text-muted-foreground/70 w-[40%]">
                          Nama Varian
                        </TableHead>
                        <TableHead className="font-medium text-muted-foreground/70 w-[20%]">
                          Stok
                        </TableHead>
                        <TableHead className="font-medium text-muted-foreground/70 text-right w-[20%]">
                          Harga
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.variants.map((v: any) => (
                        <TableRow
                          key={v.id}
                          className="group hover:bg-muted/30 transition-colors border-border/10 cursor-default"
                        >
                          <TableCell className="text-xs font-mono text-muted-foreground/80 group-hover:text-foreground/80 transition-colors">
                            {v.sku || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-[15px]">
                            {v.name || 'Tanpa Nama'}
                          </TableCell>
                          <TableCell>
                            <span className="text-[15px]">
                              {v.stock ?? 0}{' '}
                              <span className="text-muted-foreground/70 text-sm ml-0.5">
                                {v.unit || 'pcs'}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-[15px]">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              maximumFractionDigits: 0,
                            }).format(v.price || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
