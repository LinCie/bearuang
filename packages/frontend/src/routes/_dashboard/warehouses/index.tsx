import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, Warehouse, MapPin, Eye } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  WarehouseFormSheet,
  DeleteDialog,
} from '#modules/warehouses/index'
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse as WarehouseType,
} from '#modules/warehouses/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/warehouses/')({
  component: WarehousesPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

function WarehousesPage() {
  const navigate = useNavigate({ from: '/warehouses/' })
  const { search: searchParam } = Route.useSearch()

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState(searchParam ?? '')
  const debouncedSearch = useDebounce(search, 300)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingWarehouse, setEditingWarehouse] =
    React.useState<WarehouseType | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingWarehouse, setDeletingWarehouse] =
    React.useState<WarehouseType | null>(null)

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    navigate({
      search: () => ({ search: debouncedSearch || undefined }),
      replace: true,
    })
  }, [debouncedSearch, navigate])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const { data, isLoading, isError } = useWarehouses({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()
  const deleteWarehouse = useDeleteWarehouse()

  const canCreate = useHasPermission('warehouse:create')
  const canUpdate = useHasPermission('warehouse:update')

  const warehouses = data?.data ?? []
  const meta = data?.meta

  const handleCreate = React.useCallback(() => {
    setEditingWarehouse(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((warehouse: WarehouseType) => {
    setDeletingWarehouse(warehouse)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingWarehouse) return
    await deleteWarehouse.mutateAsync(deletingWarehouse.id)
    setDeleteDialogOpen(false)
    setDeletingWarehouse(null)
  }, [deletingWarehouse, deleteWarehouse])

  async function handleSubmit(values: {
    name: string
    address: string
    isActive: boolean
  }) {
    if (editingWarehouse) {
      const input: UpdateWarehouseInput & { id: string } = {
        id: editingWarehouse.id,
        name: values.name,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await updateWarehouse.mutateAsync(input)
    } else {
      const input: CreateWarehouseInput = {
        name: values.name,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await createWarehouse.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingWarehouse(null)
  }

  const columns = React.useMemo<ColumnDef<WarehouseType>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <Link
              to="/warehouses/$warehouseId"
              params={{ warehouseId: row.original.id }}
              className="font-medium text-foreground truncate hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-sm w-fit"
              title={row.original.name}
            >
              {row.original.name}
            </Link>
            {row.original.address && (
              <span
                className="text-xs text-muted-foreground mt-0.5 line-clamp-1 flex items-center gap-1"
                title={row.original.address}
              >
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {row.original.address}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              row.original.isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                row.original.isActive ? 'bg-primary' : 'bg-muted-foreground/40'
              }`}
            />
            {row.original.isActive ? 'Aktif' : 'Nonaktif'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} title="Dibuat" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover/row:opacity-100">
            <Link
              to="/warehouses/$warehouseId"
              params={{ warehouseId: row.original.id }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Lihat detail gudang"
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Lihat detail gudang</span>
              </Button>
            </Link>
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
                title="Edit gudang"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit gudang</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus gudang"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus gudang</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate],
  )

  const table = useReactTable({
    data: warehouses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">
            Daftar Gudang
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola lokasi penyimpanan dan pusat distribusi barang Anda.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={handleCreate}
            size="lg"
            className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tambah Gudang
          </Button>
        )}
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: Warehouse,
          title: 'Memuat daftar gudang',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data gudang Anda 🐻',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar gudang.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
          title: 'Hmm, dicari-cari kok tidak ada 🤔',
        }}
        emptyState={{
          icon: Warehouse,
          title: 'Belum ada gudang nih! 🐻',
          description:
            'Saatnya menambahkan lokasi penyimpanan pertama Anda. Dengan gudang, Anda bisa mengatur stok barang dengan lebih terorganisir.',
          ...(canCreate && {
            action: {
              label: 'Tambah Gudang Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari gudang berdasarkan nama atau alamat..."
        searchAriaLabel="Cari gudang"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="gudang"
      />

      <WarehouseFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingWarehouse(null)
        }}
        warehouse={editingWarehouse}
        onSubmit={handleSubmit}
        isPending={createWarehouse.isPending || updateWarehouse.isPending}
        mode={editingWarehouse ? 'edit' : 'create'}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus gudang?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {deletingWarehouse?.name}
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
