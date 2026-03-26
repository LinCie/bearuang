import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  Package,
  SearchX,
  ArrowLeftRight,
  Boxes,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useStockMovements,
  useCreateStockMovement,
  useDeleteStockMovement,
  StockMovementFormSheet,
  StockMovementsTable,
  StockMovementsFilters,
  DeleteDialog,
} from '@/modules/stock-movements'
import { useWarehouses } from '@/modules/warehouses'
import { useVariants } from '@/modules/products'
import type { StockMovementType } from '@/modules/stock-movements'
import { useDebounce } from '@/hooks/use-debounce'
import { useHasPermission } from '@/lib/use-permissions'

export const Route = createFileRoute('/_dashboard/stock-movements/')({
  component: StockMovementsPage,
  validateSearch: (
    search,
  ): { warehouseId?: string; variantId?: string; search?: string } => ({
    warehouseId: (search.warehouseId as string) || undefined,
    variantId: (search.variantId as string) || undefined,
    search: (search.search as string) || undefined,
  }),
})

function StockMovementsPage() {
  const navigate = useNavigate({ from: '/stock-movements/' })
  const canAdjust = useHasPermission('stock:adjust')
  const search = useSearch({
    from: '/_dashboard/stock-movements/',
  })
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = React.useState<{
    sortBy: 'createdAt' | 'quantity' | 'type'
    sortOrder: 'asc' | 'desc'
  }>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  // Filters state
  const [filters, setFilters] = React.useState({
    warehouseId: search.warehouseId ?? '',
    variantId: search.variantId ?? '',
    type: '' as StockMovementType | '',
    search: search.search ?? '',
  })

  const debouncedSearch = useDebounce(filters.search, 300)

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingMovementId, setDeletingMovementId] = React.useState<
    string | null
  >(null)

  // Reset pagination when filters change
  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [debouncedSearch, filters.warehouseId, filters.variantId, filters.type])

  // Sync URL with search state
  React.useEffect(() => {
    navigate({
      search: () => ({ search: debouncedSearch || undefined }),
      replace: true,
    })
  }, [debouncedSearch, navigate])

  // Fetch data
  const { data, isLoading, isError } = useStockMovements({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy: sorting.sortBy,
    sortOrder: sorting.sortOrder,
    variantId: filters.variantId || undefined,
    warehouseId: filters.warehouseId || undefined,
    type: filters.type || undefined,
    search: debouncedSearch || undefined,
  })

  const { data: warehousesData } = useWarehouses({ page: 1, pageSize: 100 })
  const { data: variantsData } = useVariants({ page: 1, pageSize: 100 })

  const createMovement = useCreateStockMovement()
  const deleteMovement = useDeleteStockMovement()

  const movements = data?.data ?? []
  const meta = data?.meta

  const warehouses = (warehousesData?.data ?? []).map(
    (w: { id: string; name: string }) => ({
      id: w.id,
      name: w.name,
    }),
  )

  const variants = (variantsData?.data ?? []).map(
    (v: { id: string; name: string; sku: string }) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
    }),
  )

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleSort = React.useCallback(
    (column: 'createdAt' | 'quantity' | 'type') => {
      setSorting((prev) => ({
        sortBy: column,
        sortOrder:
          prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      }))
    },
    [],
  )

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingMovementId) return
    await deleteMovement.mutateAsync(deletingMovementId)
    setDeleteDialogOpen(false)
    setDeletingMovementId(null)
  }, [deletingMovementId, deleteMovement])

  async function handleSubmit(values: {
    warehouseId: string
    variantId: string
    type: StockMovementType
    quantity: number
    note: string
  }) {
    await createMovement.mutateAsync({
      ...values,
      note: values.note || undefined,
    })
    setSheetOpen(false)
  }

  // Find deleting movement name for dialog
  const deletingMovement = movements.find((m) => m.id === deletingMovementId)

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Page Header & Toolbar */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              Pergerakan Stok
            </h2>
            <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
              Lacak perubahan stok barang masuk, keluar, dan penyesuaian di
              seluruh gudang.
            </p>
          </div>
          {canAdjust && (
            <Button
              onClick={handleCreate}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Catat Pergerakan
            </Button>
          )}
        </div>

        {/* Filters */}
        <StockMovementsFilters
          warehouses={warehouses}
          variants={variants}
          filters={filters}
          onFilterChange={setFilters}
          preselectedWarehouseId={search.warehouseId}
          preselectedVariantId={search.variantId}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        {isLoading ? (
          <div className="py-20">
            <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
              <div className="relative mb-8 mt-4 group">
                <div
                  className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl animate-pulse"
                  style={{ animationDuration: '3s' }}
                />
                <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-50/80 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">
                  <ArrowLeftRight
                    className="h-9 w-9 text-orange-500 animate-bounce"
                    style={{ animationDuration: '1.5s' }}
                    strokeWidth={1.5}
                  />
                </div>
                <div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/5 dark:bg-white/5 rounded-[100%] blur-[3px] animate-pulse"
                  style={{ animationDuration: '1.5s' }}
                />
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-1">
                  <span className="inline-block text-orange-900 dark:text-orange-100">
                    Memuat data pergerakan stok
                  </span>
                  <span className="inline-flex gap-0.5 ml-0.5 text-orange-500">
                    <span
                      className="animate-bounce"
                      style={{
                        animationDelay: '0ms',
                        animationDuration: '1.5s',
                      }}
                    >
                      .
                    </span>
                    <span
                      className="animate-bounce"
                      style={{
                        animationDelay: '150ms',
                        animationDuration: '1.5s',
                      }}
                    >
                      .
                    </span>
                    <span
                      className="animate-bounce"
                      style={{
                        animationDelay: '300ms',
                        animationDuration: '1.5s',
                      }}
                    >
                      .
                    </span>
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto text-balance">
                  Tunggu sebentar ya, kami sedang mengambil data pergerakan stok
                  Anda 🐻
                </p>
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-destructive font-medium text-lg">
              Aduh, gagal memuat data pergerakan stok.
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
              Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali
              lagi.
            </p>
            <Button
              variant="outline"
              className="px-6"
              onClick={() => window.location.reload()}
            >
              Coba Muat Ulang
            </Button>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-24">
            {filters.search ||
            filters.warehouseId ||
            filters.variantId ||
            filters.type ? (
              <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-8 group cursor-default">
                  <div className="absolute inset-0 bg-stone-100/80 dark:bg-stone-900/40 rounded-full blur-2xl group-hover:bg-stone-200/80 transition-colors duration-500" />
                  <div className="relative flex items-center justify-center">
                    <div className="absolute -top-3 -right-3 h-8 w-8 text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500 delay-100">
                      <SearchX className="h-full w-full" />
                    </div>

                    <div className="relative h-20 w-20 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800/50 flex items-center justify-center rotate-3 group-hover:rotate-12 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 shadow-sm group-hover:shadow-md cursor-help">
                      <ArrowLeftRight className="h-8 w-8 text-stone-400 dark:text-stone-500 transition-transform duration-500 group-hover:scale-95 group-hover:opacity-80" />
                      <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:rotate-[-15deg] transition-all duration-500 delay-75">
                        <SearchX className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                      </div>
                    </div>
                  </div>
                </div>{' '}
                <h3 className="text-xl font-medium text-foreground mb-3 transition-colors duration-500 group-hover:text-stone-700 dark:group-hover:text-stone-300 whitespace-normal">
                  Tidak ada hasil yang cocok 🤔
                </h3>
                <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                  Coba ubah filter atau kata kunci pencarian Anda untuk
                  menemukan data pergerakan stok.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      warehouseId: search.warehouseId ?? '',
                      variantId: search.variantId ?? '',
                      type: '',
                      search: '',
                    })
                  }
                  className="px-8 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
                >
                  Reset Filter
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-10 group cursor-default">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />

                  <div className="relative flex items-center justify-center">
                    <div className="absolute -left-6 top-1 h-14 w-14 rounded-2xl bg-orange-100/90 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800/60 flex items-center justify-center -rotate-12 group-hover:-rotate-25 group-hover:-translate-x-3 group-hover:-translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md">
                      <Boxes className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="absolute -right-5 -bottom-2 h-12 w-12 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center rotate-12 group-hover:rotate-25 group-hover:translate-x-3 group-hover:translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md delay-75">
                      <Plus className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                    </div>

                    <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                      <Package
                        className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </div>

                <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                  Belum ada pergerakan stok! 🐻
                </h3>
                <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                  Saatnya mencatat perubahan stok pertama Anda. Pantau
                  pergerakan barang masuk, keluar, dan penyesuaian stok dengan
                  mudah.
                </p>
                {canAdjust && (
                  <Button
                    onClick={handleCreate}
                    size="lg"
                    className="px-8 h-12 text-base shadow-sm hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
                  >
                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                    <span className="relative flex items-center font-medium">
                      <Plus className="mr-2 h-5 w-5" />
                      Catat Pergerakan Pertama
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <StockMovementsTable
            movements={movements}
            sortBy={sorting.sortBy}
            sortOrder={sorting.sortOrder}
            onSort={handleSort}
          />
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && !isLoading && movements.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-border/40 text-sm text-muted-foreground gap-5 sm:gap-0 mx-2 pb-6">
          <p className="text-center sm:text-left text-balance">
            Menampilkan{' '}
            <span className="text-foreground font-medium mx-1">
              {pagination.pageIndex * pagination.pageSize + 1}
            </span>
            –
            <span className="text-foreground font-medium mx-1">
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                meta.total,
              )}
            </span>
            dari{' '}
            <span className="text-foreground font-medium mx-1">
              {meta.total}
            </span>{' '}
            pergerakan
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
              disabled={!meta.hasPrev}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
              }
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
              disabled={!meta.hasNext}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
              }
            >
              Selanjutnya
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Sheet */}
      <StockMovementFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        warehouses={warehouses}
        variants={variants}
        onSubmit={handleSubmit}
        isPending={createMovement.isPending}
        preselectedWarehouseId={search.warehouseId}
        preselectedVariantId={search.variantId}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pergerakan stok?"
        description={
          <>
            Anda akan menghapus pergerakan stok{' '}
            <span className="font-medium text-foreground">
              {deletingMovement?.variant.name}
            </span>{' '}
            di gudang{' '}
            <span className="font-medium text-foreground">
              {deletingMovement?.warehouse.name}
            </span>
            . Tindakan ini akan mengembalikan stok ke kondisi sebelumnya.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteMovement.isPending}
        confirmLabel="Ya, Hapus Pergerakan"
      />
    </>
  )
}
