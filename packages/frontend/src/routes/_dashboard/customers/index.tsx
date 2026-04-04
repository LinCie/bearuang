import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, Users, Eye, Phone, Mail } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  CustomerFormSheet,
  DeleteDialog,
} from '#modules/customers/index'
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  Customer,
} from '#modules/customers/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/customers/')({
  component: CustomersPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

function CustomersPage() {
  const navigate = useNavigate({ from: '/customers/' })
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
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(
    null,
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingCustomer, setDeletingCustomer] =
    React.useState<Customer | null>(null)

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

  const { data, isLoading, isError } = useCustomers({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const canCreate = useHasPermission('customer:create')
  const canUpdate = useHasPermission('customer:update')

  const customers = data?.data ?? []
  const meta = data?.meta

  const handleCreate = React.useCallback(() => {
    setEditingCustomer(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((customer: Customer) => {
    setEditingCustomer(customer)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((customer: Customer) => {
    setDeletingCustomer(customer)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingCustomer) return
    await deleteCustomer.mutateAsync(deletingCustomer.id)
    setDeleteDialogOpen(false)
    setDeletingCustomer(null)
  }, [deletingCustomer, deleteCustomer])

  async function handleSubmit(values: {
    name: string
    email: string
    phone: string
    address: string
    isActive: boolean
  }) {
    if (editingCustomer) {
      const input: UpdateCustomerInput & { id: string } = {
        id: editingCustomer.id,
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await updateCustomer.mutateAsync(input)
    } else {
      const input: CreateCustomerInput = {
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
      }
      await createCustomer.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingCustomer(null)
  }

  const columns = React.useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <Link
              to="/customers/$customerId"
              params={{ customerId: row.original.id }}
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
              to="/customers/$customerId"
              params={{ customerId: row.original.id }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Lihat detail pelanggan"
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Lihat detail pelanggan</span>
              </Button>
            </Link>
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
                title="Edit pelanggan"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit pelanggan</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus pelanggan"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus pelanggan</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate],
  )

  const table = useReactTable({
    data: customers,
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
            Daftar Pelanggan
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola data pelanggan dan klien yang berhubungan dengan bisnis Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/customers/trashed">
            <Button
              variant="outline"
              size="lg"
              className="active:scale-95 shadow-sm"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Pelanggan Terhapus
            </Button>
          </Link>
          {canCreate && (
            <Button
              onClick={handleCreate}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Tambah Pelanggan
            </Button>
          )}
        </div>
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: Users,
          title: 'Memuat daftar pelanggan',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data pelanggan Anda',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar pelanggan.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
          title: 'Hmm, dicari-cari kok tidak ada',
        }}
        emptyState={{
          icon: Users,
          title: 'Belum ada pelanggan nih!',
          description:
            'Saatnya menambahkan pelanggan pertama Anda. Dengan pelanggan, Anda bisa mengelola hubungan bisnis dan meningkatkan layanan.',
          ...(canCreate && {
            action: {
              label: 'Tambah Pelanggan Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari pelanggan berdasarkan nama, email, telepon, atau alamat..."
        searchAriaLabel="Cari pelanggan"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="pelanggan"
      />

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingCustomer(null)
        }}
        customer={editingCustomer}
        onSubmit={handleSubmit}
        isPending={createCustomer.isPending || updateCustomer.isPending}
        mode={editingCustomer ? 'edit' : 'create'}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pelanggan?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {deletingCustomer?.name}
            </span>
            . Pelanggan ini akan dipindahkan ke tempat sampah dan dapat
            dipulihkan nanti.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteCustomer.isPending}
        confirmLabel="Ya, Hapus Pelanggan"
      />
    </>
  )
}
