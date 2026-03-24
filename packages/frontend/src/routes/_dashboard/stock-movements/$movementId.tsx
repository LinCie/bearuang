import { createFileRoute, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import {
  useStockMovement,
  useDeleteStockMovement,
  MovementDetailHeader,
  MovementLoadingState,
  MovementErrorState,
  DeleteDialog,
} from '@/modules/stock-movements'
import type { StockMovementType } from '@/modules/stock-movements'

export const Route = createFileRoute('/_dashboard/stock-movements/$movementId')({
  component: StockMovementDetailPage,
})

// ─── Types ────────────────────────────────────────────────────

interface StockMovementItem {
  id: string
  organizationId: string
  warehouseId: string
  variantId: string
  type: StockMovementType
  quantity: number
  referenceId: string | null
  referenceType: string | null
  note: string | null
  createdAt: string
  variant: { id: string; sku: string; name: string }
  warehouse: { id: string; name: string }
}

// ─── Utilities ────────────────────────────────────────────────

function getTypeLabel(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'Masuk'
    case 'OUT':
      return 'Keluar'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    default:
      return type
  }
}

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

// ─── Page Component ───────────────────────────────────────────

function StockMovementDetailPage() {
  const { movementId } = Route.useParams()
  const router = useRouter()
  const { data: movement, isLoading, isError, refetch } = useStockMovement(movementId)

  // Mutations
  const deleteMovement = useDeleteStockMovement()

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  // ─── Handlers ──────────────────────────────────────────────

  const handleEdit = React.useCallback(() => {
    // Stock movements are immutable records, edit is not supported
    // Could show a toast message or open an edit sheet in the future
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!movement) return
    await deleteMovement.mutateAsync(movement.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/stock-movements', search: { warehouseId: '', variantId: '' } })
  }, [movement, deleteMovement, router])

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <MovementLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !movement) {
    return <MovementErrorState onRetry={() => refetch()} />
  }

  const movementData = movement as StockMovementItem

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <MovementDetailHeader
          movement={movementData}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

        {/* Content Section */}
        <section className="flex flex-col gap-10 lg:pl-14">
          {/* Movement Summary */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Ringkasan Pergerakan
            </h2>
            <div className="flex items-center gap-6 p-6 bg-card border border-border/40 rounded-xl shadow-sm">
              <div className={`flex items-center justify-center h-16 w-16 rounded-2xl ${
                movementData.type === 'IN' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : movementData.type === 'OUT'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-amber-100 text-amber-600'
              }`}>
                <span className={`text-2xl font-bold ${
                  movementData.type === 'OUT' ? 'text-rose-600' : 
                  movementData.type === 'IN' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {movementData.type === 'OUT' ? '-' : '+'}{movementData.quantity}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Jumlah Perubahan Stok</span>
                <span className="text-lg font-medium text-foreground">
                  {getTypeLabel(movementData.type)} - {movementData.quantity} unit
                </span>
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Produk
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground mb-1">Nama Varian</dt>
                <dd className="text-base font-medium text-foreground">
                  {movementData.variant.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">SKU</dt>
                <dd className="text-sm font-mono text-foreground/70 bg-muted/40 px-2 py-1 rounded inline-block">
                  {movementData.variant.sku}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">ID Varian</dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {movementData.variant.id.slice(0, 8)}...{movementData.variant.id.slice(-4)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Warehouse Information */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Gudang
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Nama Gudang</dt>
                <dd className="text-base font-medium text-foreground">
                  {movementData.warehouse.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">ID Gudang</dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {movementData.warehouse.id.slice(0, 8)}...{movementData.warehouse.id.slice(-4)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Reference Information */}
          {movementData.referenceId && (
            <div className="flex flex-col gap-5">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Informasi Referensi
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Tipe Referensi</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {movementData.referenceType || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">ID Referensi</dt>
                  <dd className="text-sm font-mono text-foreground/70">
                    {movementData.referenceId.slice(0, 8)}...{movementData.referenceId.slice(-4)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Catatan
            </h2>
            {movementData.note ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap max-w-3xl bg-muted/30 p-4 rounded-lg">
                {movementData.note}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Tidak ada catatan untuk pergerakan stok ini.
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Metadata
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">ID Pergerakan</dt>
                <dd className="text-sm font-mono text-foreground/70 break-all">
                  {movementData.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">ID Organisasi</dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {movementData.organizationId.slice(0, 8)}...{movementData.organizationId.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Dibuat pada</dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }).format(new Date(movementData.createdAt))}
                  <span className="text-muted-foreground text-xs ml-2">
                    ({formatRelativeTime(movementData.createdAt)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pergerakan stok?"
        description={
          <>
            Anda akan menghapus pergerakan stok{' '}
            <span className="font-medium text-foreground">
              {getTypeLabel(movementData.type)}
            </span>{' '}
            sebesar{' '}
            <span className="font-medium text-foreground">
              {movementData.quantity} unit
            </span>{' '}
            untuk varian{' '}
            <span className="font-medium text-foreground">
              {movementData.variant.name}
            </span>
            . Tindakan ini akan membalikkan efek pada stok varian dan tidak bisa
            dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteMovement.isPending}
        confirmLabel="Ya, Hapus Pergerakan"
      />
    </>
  )
}
