import { createFileRoute, useSearch, useNavigate, Link } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'
import {
  Plus,
  ArrowLeftRight,
  Package,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'
import {
  useStockMovements,
  useCreateStockMovement,
  useDeleteStockMovement,
  StockMovementFormSheet,
  StockMovementsFilters,
  DeleteDialog,
} from '#modules/stock-movements/index'
import type {
  StockMovement,
  StockMovementType,
} from '#modules/stock-movements/index'
import { useWarehouses } from '#modules/warehouses/index'
import { useVariants } from '#modules/products/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'

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

function getReferenceLink(referenceType: string, referenceId: string) {
  switch (referenceType) {
    case 'purchase_order':
      return {
        to: '/purchase-orders/$purchaseOrderId',
        params: { purchaseOrderId: referenceId },
      }
    case 'sales_order':
      return {
        to: '/sales-orders/$salesOrderId',
        params: { salesOrderId: referenceId },
      }
    default:
      return null
  }
}

function getTypeBadgeStyles(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    case 'OUT':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    case 'ADJUSTMENT':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

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

function StockMovementsPage() {
  const navigate = useNavigate({ from: '/stock-movements/' })
  const canAdjust = useHasPermission('stock:adjust')
  const search = useSearch({
    from: '/_dashboard/stock-movements/',
  })
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const [filters, setFilters] = React.useState({
    warehouseId: search.warehouseId ?? '',
    variantId: search.variantId ?? '',
    type: '' as StockMovementType | '',
    search: search.search ?? '',
  })

  const debouncedSearch = useDebounce(filters.search, 300)

  const [sheetOpen, setSheetOpen] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingMovementId, setDeletingMovementId] = React.useState<
    string | null
  >(null)

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.warehouseId ||
      filters.variantId ||
      filters.type,
  )

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [debouncedSearch, filters.warehouseId, filters.variantId, filters.type])

  React.useEffect(() => {
    navigate({
      search: () => ({ search: debouncedSearch || undefined }),
      replace: true,
    })
  }, [debouncedSearch, navigate])

  const sortBy = sorting[0]?.id as
    | 'createdAt'
    | 'quantity'
    | 'type'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const handleSearchChange = (value: string) => {
    setFilters((f) => ({ ...f, search: value }))
  }

  const { data, isLoading, isError } = useStockMovements({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
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

  const handleCreate = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

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

  const deletingMovement = movements.find((m) => m.id === deletingMovementId)

  const handleResetFilters = React.useCallback(() => {
    setFilters({
      warehouseId: search.warehouseId ?? '',
      variantId: search.variantId ?? '',
      type: '',
      search: '',
    })
  }, [search.warehouseId, search.variantId])

  const columns = React.useMemo<ColumnDef<StockMovement>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} title="Tanggal" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {new Date(row.original.createdAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <SortableHeader column={column} title="Tipe" />
        ),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeStyles(row.original.type)}`}
          >
            {getTypeLabel(row.original.type)}
          </span>
        ),
      },
      {
        id: 'variant',
        header: 'Produk',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {row.original.variant.name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {row.original.variant.sku}
            </span>
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: 'Gudang',
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {row.original.warehouse.name}
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: ({ column }) => (
          <SortableHeader column={column} title="Jumlah" />
        ),
        cell: ({ row }) => (
          <span
            className={`text-right font-medium ${
              row.original.type === 'OUT'
                ? 'text-rose-600 dark:text-rose-400'
                : row.original.type === 'IN'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-foreground'
            }`}
          >
            {row.original.type === 'OUT' ? '-' : '+'}
            {row.original.quantity}
          </span>
        ),
      },
      {
        id: 'reference',
        header: 'Referensi',
        cell: ({ row }) => {
          const m = row.original
          if (!m.referenceId) {
            return (
              <span className="text-muted-foreground text-xs">Manual</span>
            )
          }
          const link = m.referenceType
            ? getReferenceLink(m.referenceType, m.referenceId)
            : null
          return (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {m.referenceType}
              </span>
              {link ? (
                <Link
                  to={link.to}
                  params={link.params}
                  className="font-mono text-xs truncate max-w-[120px] text-primary hover:underline"
                >
                  {m.referenceId.slice(0, 8)}...
                </Link>
              ) : (
                <span className="font-mono text-xs truncate max-w-[120px]">
                  {m.referenceId.slice(0, 8)}...
                </span>
              )}
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: movements,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  return (
    <>
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

        <StockMovementsFilters
          warehouses={warehouses}
          variants={variants}
          filters={filters}
          onFilterChange={setFilters}
          preselectedWarehouseId={search.warehouseId}
          preselectedVariantId={search.variantId}
        />
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: ArrowLeftRight,
          title: 'Memuat data pergerakan stok',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data pergerakan stok Anda 🐻',
        }}
        errorState={{
          title: 'Aduh, gagal memuat data pergerakan stok.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setFilters((f) => ({ ...f, search: '' })),
          title: 'Tidak ada hasil yang cocok 🤔',
        }}
        emptyState={
          hasActiveFilters
            ? {
                icon: ArrowLeftRight,
                title: 'Tidak ada hasil yang cocok 🤔',
                description:
                  'Coba ubah filter atau kata kunci pencarian Anda untuk menemukan data pergerakan stok.',
                action: {
                  label: 'Reset Filter',
                  onClick: handleResetFilters,
                },
              }
            : {
                icon: Package,
                title: 'Belum ada pergerakan stok! 🐻',
                description:
                  'Saatnya mencatat perubahan stok pertama Anda. Pantau pergerakan barang masuk, keluar, dan penyesuaian stok dengan mudah.',
                ...(canAdjust && {
                  action: {
                    label: 'Catat Pergerakan Pertama',
                    onClick: handleCreate,
                    icon: Plus,
                  },
                }),
              }
        }
        search={filters.search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari pergerakan stok..."
        searchAriaLabel="Cari pergerakan stok"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="pergerakan"
        getHeaderClassName={(headerId) => {
          if (headerId === 'quantity') return 'text-right'
          return undefined
        }}
      />

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
