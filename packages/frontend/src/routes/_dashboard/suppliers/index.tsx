import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, Truck, Eye, Phone, Mail } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  SupplierFormSheet,
  DeleteDialog,
} from '#modules/suppliers/index'
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  Supplier,
} from '#modules/suppliers/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/suppliers/')({
  component: SuppliersPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

// ─── Component ────────────────────────────────────────────────

function SuppliersPage() {
  const navigate = useNavigate({ from: '/suppliers/' })
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

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(
    null,
  )

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingSupplier, setDeletingSupplier] =
    React.useState<Supplier | null>(null)

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  // Sync URL with search state
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

  const { data, isLoading, isError } = useSuppliers({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const deleteSupplier = useDeleteSupplier()

  const canCreate = useHasPermission('supplier:create')
  const canUpdate = useHasPermission('supplier:update')

  const suppliers = data?.data ?? []
  const meta = data?.meta

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = React.useCallback(() => {
    setEditingSupplier(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((supplier: Supplier) => {
    setDeletingSupplier(supplier)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingSupplier) return
    await deleteSupplier.mutateAsync(deletingSupplier.id)
    setDeleteDialogOpen(false)
    setDeletingSupplier(null)
  }, [deletingSupplier, deleteSupplier])

  async function handleSubmit(values: {
    name: string
    email: string
    phone: string
    address: string
    isActive: boolean
  }) {
    if (editingSupplier) {
      const input: UpdateSupplierInput & { id: string } = {
        id: editingSupplier.id,
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await updateSupplier.mutateAsync(input)
    } else {
      const input: CreateSupplierInput = {
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
      }
      await createSupplier.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingSupplier(null)
  }

  // ─── Table Columns ─────────────────────────────────────────

  const columns = React.useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <Link
              to="/suppliers/$supplierId"
              params={{ supplierId: row.original.id }}
              className="font-medium text-foreground truncate hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-sm w-fit"
              title={row.original.name}
            >
              {row.original.name}
            </Link>
            {row.original.email && (
              <span
                className="text-xs text-muted-foreground mt-0.5 line-clamp-1 flex items-center gap-1"
                title={row.original.email}
              >
                <Mail className="h-3 w-3 flex-shrink-0" />
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Telepon',
        cell: ({ row }) => {
          const phone = row.original.phone
          if (!phone) {
            return (
              <span className="text-muted-foreground text-sm italic">-</span>
            )
          }
          return (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {phone}
            </span>
          )
        },
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
              to="/suppliers/$supplierId"
              params={{ supplierId: row.original.id }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Lihat detail pemasok"
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Lihat detail pemasok</span>
              </Button>
            </Link>
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
                title="Edit pemasok"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit pemasok</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus pemasok"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus pemasok</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate],
  )

  const table = useReactTable({
    data: suppliers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">
            Daftar Pemasok
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola data pemasok dan vendor yang berhubungan dengan bisnis Anda.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={handleCreate}
            size="lg"
            className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tambah Pemasok
          </Button>
        )}
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: Truck,
          title: 'Memuat daftar pemasok',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data pemasok Anda',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar pemasok.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
          title: 'Hmm, dicari-cari kok tidak ada',
        }}
        emptyState={{
          icon: Truck,
          title: 'Belum ada pemasok nih!',
          description:
            'Saatnya menambahkan pemasok pertama Anda. Dengan pemasok, Anda bisa mengelola sumber barang dan mengoptimalkan rantai pasok.',
          ...(canCreate && {
            action: {
              label: 'Tambah Pemasok Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari pemasok berdasarkan nama, email, telepon, atau alamat..."
        searchAriaLabel="Cari pemasok"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="pemasok"
      />

      {/* Create / Edit Sheet */}
      <SupplierFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingSupplier(null)
        }}
        supplier={editingSupplier}
        onSubmit={handleSubmit}
        isPending={createSupplier.isPending || updateSupplier.isPending}
        mode={editingSupplier ? 'edit' : 'create'}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pemasok?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {deletingSupplier?.name}
            </span>
            . Pemasok ini akan dihapus secara permanen dan tidak bisa
            dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteSupplier.isPending}
        confirmLabel="Ya, Hapus Pemasok"
      />
    </>
  )
}
