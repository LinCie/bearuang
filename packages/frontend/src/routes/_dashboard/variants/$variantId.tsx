import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
import * as React from 'react'
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import {
  useVariant,
  useUpdateVariant,
  useDeleteVariant,
  useRestoreVariant,
  VariantFormSheet,
  DeleteDialog,
} from '@/modules/products'
import type { UpdateVariantInput } from '@/modules/products'
import {
  useVariantStockMovements,
  StockMovementsTable,
} from '@/modules/stock-movements'
import { ImageGallery } from '@/components/ui/image-gallery'
import type { GalleryImage } from '@/components/ui/image-gallery'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/lib/use-permissions'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/variants/$variantId')({
  component: VariantDetailPage,
})

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`
  if (diffHours < 24) return `${diffHours} jam yang lalu`
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return `${diffDays} hari yang lalu`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`
  return `${Math.floor(diffDays / 30)} bulan yang lalu`
}

function VariantLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative flex items-center justify-center h-20 w-20 mb-6">
        <div className="absolute inset-0 rounded-3xl bg-amber-500/15 animate-ping opacity-75 duration-1000" />
        <div className="relative flex items-center justify-center h-full w-full rounded-2xl bg-amber-50 border border-amber-200/50 text-amber-600 shadow-sm transition-transform hover:scale-105">
          <div className="h-8 w-8 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
        </div>
      </div>
      <p className="text-sm font-medium text-amber-800/70 animate-pulse">
        Memuat detail varian...
      </p>
    </div>
  )
}

function VariantErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
      <p className="text-destructive/90 text-sm md:text-base text-center max-w-sm px-4 leading-relaxed mb-6">
        Varian tidak dapat ditemukan.
      </p>
      <Link to="/products">
        <button
          type="button"
          className="rounded-full border border-border/50 px-6 py-2 text-sm font-medium hover:bg-muted/30 transition-transform active:scale-95"
        >
          Kembali
        </button>
      </Link>
    </div>
  )
}

function VariantDetailPage() {
  const { variantId } = Route.useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: variant, isLoading, isError } = useVariant(variantId)

  const { data: movementsData } = useVariantStockMovements(variantId)
  const movements = movementsData?.data ?? []

  const updateVariant = useUpdateVariant()
  const deleteVariant = useDeleteVariant()
  const restoreVariant = useRestoreVariant()

  const canUpdate = useHasPermission('product:update')

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const handleEdit = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!variant) return
    await deleteVariant.mutateAsync(variant.id)
    setDeleteDialogOpen(false)
    router.navigate({
      to: '/products/$productId',
      params: { productId: variant.productId },
    })
  }, [variant, deleteVariant, router])

  const handleRestore = React.useCallback(async () => {
    if (!variant) return
    await restoreVariant.mutateAsync(variant.id)
    toast.success(`Varian "${variant.name}" telah dipulihkan`)
  }, [variant, restoreVariant])

  async function handleSubmit(values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
    pendingImages: { id: string }[]
    removedImageIds: string[]
  }) {
    if (!variant) return
    const input: UpdateVariantInput & { id: string } = {
      id: variant.id,
      sku: values.sku,
      name: values.name,
      price: values.price,
      unit: values.unit || undefined,
      isActive: values.isActive,
    }
    await updateVariant.mutateAsync(input)

    for (const imageId of values.removedImageIds) {
      await api.variants({ id: variant.id }).images({ imageId }).delete()
    }
    for (const media of values.pendingImages) {
      await api.variants({ id: variant.id }).images.post({ mediaId: media.id })
    }

    queryClient.invalidateQueries({
      queryKey: ['variants', 'detail', variant.id],
    })
    queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    setSheetOpen(false)
  }

  if (isLoading) {
    return <VariantLoadingState />
  }

  if (isError || !variant) {
    return <VariantErrorState />
  }

  const isTrashed = !!variant.deletedAt
  const attributes = variant.attributes as Record<string, string> | null

  return (
    <>
      <div className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 lg:gap-5">
          <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
            <div className="pt-1.5 shrink-0">
              <Link
                to="/products/$productId"
                params={{ productId: variant.productId }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
                  aria-label="Kembali ke produk"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-col gap-3 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight wrap-break-word">
                {variant.name || 'Varian Tanpa Nama'}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Link
                  to="/products/$productId"
                  params={{ productId: variant.productId }}
                  className="text-amber-700 hover:text-amber-800 font-medium transition-colors"
                >
                  {variant.product.name}
                </Link>
                <span className="opacity-30">•</span>
                <span
                  className={`flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30 ${
                    isTrashed ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      variant.isActive
                        ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                        : 'bg-muted-foreground/40'
                    }`}
                  />
                  {isTrashed
                    ? 'Dihapus'
                    : variant.isActive
                      ? 'Aktif'
                      : 'Nonaktif'}
                </span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                    {variant.sku}
                  </span>
                </span>
                <span className="opacity-30">•</span>
                <span>
                  Diperbarui{' '}
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(variant.updatedAt))}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0 pt-1.5">
            {isTrashed ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-100/40 transition-colors"
                onClick={handleRestore}
                disabled={restoreVariant.isPending}
                title="Pulihkan varian"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Pulihkan varian</span>
              </Button>
            ) : (
              <>
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={handleEdit}
                    title="Edit varian"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit varian</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={handleDeleteClick}
                  title="Hapus varian"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Hapus varian</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {isTrashed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Varian ini telah dihapus. Pulihkan untuk mengaktifkan kembali.
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-12 lg:pl-14">
          {/* Info */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Varian
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  ID Varian
                </dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {variant.id.slice(0, 8)}...{variant.id.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Harga</dt>
                <dd className="text-sm font-medium text-foreground">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0,
                  }).format(variant.price || 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Stok Saat Ini
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {variant.stock} {variant.unit || 'pcs'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Satuan</dt>
                <dd className="text-sm text-foreground">
                  {variant.unit || '—'}
                </dd>
              </div>
              {attributes && Object.keys(attributes).length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground mb-1">
                    Atribut
                  </dt>
                  <dd className="text-sm text-foreground">
                    {Object.entries(attributes).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 mr-2 mb-1 px-2 py-0.5 rounded-md bg-muted text-xs"
                      >
                        <span className="text-muted-foreground">{key}:</span>
                        {value}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Dibuat pada
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(variant.createdAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Terakhir diperbarui
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(variant.updatedAt))}
                  <span className="text-muted-foreground text-xs ml-2">
                    ({formatRelativeTime(variant.updatedAt)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Images */}
          {variant.images.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Gambar Varian
              </h2>
              <ImageGallery
                images={[...variant.images]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(
                    (img): GalleryImage => ({
                      src: img.media.url,
                      alt: img.altText ?? img.media.filename,
                    }),
                  )}
                columns={3}
                aspectRatio="square"
              />
            </div>
          )}

          {/* Stock Movements */}
          {movements.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Riwayat Stok
              </h2>
              <StockMovementsTable movements={movements} />
            </div>
          )}
        </div>
      </div>

      <VariantFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        variant={variant}
        onSubmit={handleSubmit}
        isPending={updateVariant.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus varian?"
        description={
          <>
            Anda akan menghapus varian{' '}
            <span className="font-medium text-foreground">{variant.name}</span>{' '}
            ({variant.sku}). Varian ini akan dipindahkan ke tempat sampah dan
            dapat dipulihkan nanti.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteVariant.isPending}
        confirmLabel="Ya, Hapus Varian"
      />
    </>
  )
}
