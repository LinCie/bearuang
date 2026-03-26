import { createFileRoute, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import {
  useWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  WarehouseDetailHeader,
  WarehouseFormSheet,
  WarehouseLoadingState,
  WarehouseErrorState,
  DeleteDialog,
} from '@/modules/warehouses'
import type { UpdateWarehouseInput } from '@/modules/warehouses'
import { useHasPermission } from '@/lib/use-permissions'

export const Route = createFileRoute('/_dashboard/warehouses/$warehouseId')({
  component: WarehouseDetailPage,
})

// ─── Utilities ────────────────────────────────────────────────

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

function WarehouseDetailPage() {
  const { warehouseId } = Route.useParams()
  const router = useRouter()
  const { data: warehouse, isLoading, isError } = useWarehouse(warehouseId)

  // Mutations
  const updateWarehouse = useUpdateWarehouse()
  const deleteWarehouse = useDeleteWarehouse()

  const canUpdate = useHasPermission('warehouse:update')

  // Edit sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  // ─── Handlers ──────────────────────────────────────────────

  const handleEdit = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!warehouse) return
    await deleteWarehouse.mutateAsync(warehouse.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/warehouses' })
  }, [warehouse, deleteWarehouse, router])

  const handleSubmit = React.useCallback(
    async (values: { name: string; address: string; isActive: boolean }) => {
      if (!warehouse) return
      const input: UpdateWarehouseInput & { id: string } = {
        id: warehouse.id,
        name: values.name,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await updateWarehouse.mutateAsync(input)
      setSheetOpen(false)
    },
    [warehouse, updateWarehouse],
  )

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <WarehouseLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !warehouse) {
    return <WarehouseErrorState />
  }

  const warehouseData = warehouse

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <WarehouseDetailHeader
          warehouse={warehouseData}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

        {/* Content Section */}
        <section className="flex flex-col gap-10 lg:pl-14">
          {/* Address */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Alamat Gudang
            </h2>
            {warehouseData.address ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                {warehouseData.address}
              </p>
            ) : (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-muted-foreground text-sm">
                  Belum ada alamat tercatat untuk gudang ini.
                </p>
                {canUpdate && (
                  <button
                    onClick={handleEdit}
                    className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                  >
                    Tambahkan alamat →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Gudang
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  ID Gudang
                </dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {warehouseData.id.slice(0, 8)}...{warehouseData.id.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      warehouseData.isActive
                        ? 'bg-amber-100/70 text-amber-800 border border-amber-200/50'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        warehouseData.isActive ? 'bg-amber-500' : 'bg-stone-400'
                      }`}
                    />
                    {warehouseData.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Dibuat pada
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(warehouseData.createdAt))}
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
                  }).format(new Date(warehouseData.updatedAt))}
                  <span className="text-muted-foreground text-xs ml-2">
                    ({formatRelativeTime(warehouseData.updatedAt)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      {/* Edit Sheet */}
      <WarehouseFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        warehouse={warehouseData}
        onSubmit={handleSubmit}
        isPending={updateWarehouse.isPending}
        mode="edit"
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus gudang?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {warehouseData.name}
            </span>
            . Gudang ini akan dihapus secara permanen dan tidak bisa
            dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteWarehouse.isPending}
        confirmLabel="Ya, Hapus Gudang"
      />
    </>
  )
}
