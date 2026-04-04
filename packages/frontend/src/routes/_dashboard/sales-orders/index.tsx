import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  Plus,
  Trash2,
  ClipboardList,
  Package,
  Building2,
  Calendar,
  Clock,
  User,
  Eye,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'
import { useHasPermission } from '#lib/use-permissions'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'

import {
  useSalesOrders,
  useCreateSalesOrder,
  useDeleteSalesOrder,
  SalesOrderFormSheet,
  StatusBadge,
  PaymentStatusBadge,
  formatRupiah,
  DeleteDialog,
} from '#modules/sales-orders/index'
import type {
  CreateSalesOrderInput,
  SalesOrder,
} from '#modules/sales-orders/index'

type StatusFilter =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'all'

type PaymentStatusFilter = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'all'

export const Route = createFileRoute('/_dashboard/sales-orders/')({
  component: SalesOrdersPage,
  validateSearch: (
    search,
  ): {
    status?: StatusFilter
    paymentStatus?: PaymentStatusFilter
    search?: string
  } => ({
    status: search.status as StatusFilter,
    paymentStatus: search.paymentStatus as PaymentStatusFilter,
    search: search.search as string | undefined,
  }),
})

function SalesOrdersPage() {
  const navigate = useNavigate({ from: '/sales-orders/' })
  const searchParams = Route.useSearch()
  const canCreate = useHasPermission('salesOrder:create')

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(
    searchParams.status ?? 'all',
  )
  const [paymentStatusFilter, setPaymentStatusFilter] =
    React.useState<PaymentStatusFilter>(searchParams.paymentStatus ?? 'all')
  const [searchQuery, setSearchQuery] = React.useState(
    searchParams.search ?? '',
  )

  const [sheetOpen, setSheetOpen] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingOrder, setDeletingOrder] = React.useState<SalesOrder | null>(
    null,
  )

  const sortBy = sorting[0]?.id as
    | 'createdAt'
    | 'updatedAt'
    | 'orderedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    navigate({
      search: () => ({
        status: statusFilter === 'all' ? undefined : statusFilter,
        paymentStatus:
          paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
        search: searchQuery || undefined,
      }),
      replace: true,
    })
  }, [statusFilter, paymentStatusFilter, searchQuery, navigate])

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const handlePaymentStatusChange = (value: PaymentStatusFilter) => {
    setPaymentStatusFilter(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const { data, isLoading, isError } = useSalesOrders({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    status: statusFilter === 'all' ? undefined : statusFilter,
    paymentStatus:
      paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
    search: searchQuery || undefined,
  })

  const createSalesOrder = useCreateSalesOrder()
  const deleteSalesOrder = useDeleteSalesOrder()

  const salesOrders = data?.data ?? []
  const meta = data?.meta

  const handleCreate = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleViewDetail = React.useCallback(
    (order: SalesOrder) => {
      navigate({
        to: '/sales-orders/$salesOrderId',
        params: { salesOrderId: order.id },
      })
    },
    [navigate],
  )

  const handleDeleteClick = React.useCallback((order: SalesOrder) => {
    setDeletingOrder(order)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingOrder) return
    await deleteSalesOrder.mutateAsync(deletingOrder.id)
    setDeleteDialogOpen(false)
    setDeletingOrder(null)
  }, [deletingOrder, deleteSalesOrder])

  async function handleSubmit(values: {
    customerId?: string
    guestName?: string
    guestEmail?: string
    warehouseId: string
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>
  }) {
    const input: CreateSalesOrderInput = {
      customerId: values.customerId,
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      warehouseId: values.warehouseId,
      items: values.items,
    }
    await createSalesOrder.mutateAsync(input)
    setSheetOpen(false)
  }

  const columns = React.useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => <SortableHeader column={column} title="ID" />,
        cell: ({ row }) => {
          const shortId = row.original.id.slice(0, 8).toUpperCase()
          return (
            <span
              className="font-medium text-foreground font-mono text-xs"
              title={row.original.id}
            >
              #{shortId}
            </span>
          )
        },
      },
      {
        accessorKey: 'customer',
        header: 'Pelanggan',
        cell: ({ row }) => {
          const customer = row.original.customer
          const guestName = row.original.guestName
          return (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate max-w-[150px]">
                {customer?.name || guestName || 'Tanpa Nama'}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'warehouse.name',
        header: 'Gudang',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate max-w-[150px]">
              {row.original.warehouse.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total',
        cell: ({ row }) => {
          const total = row.original.items.reduce(
            (sum: number, item: { unitPrice: string; quantity: number }) =>
              sum + Number(item.unitPrice) * item.quantity,
            0,
          )
          return (
            <span className="text-sm font-medium">{formatRupiah(total)}</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Status Pembayaran',
        cell: ({ row }) => (
          <PaymentStatusBadge status={row.original.paymentStatus} />
        ),
      },
      {
        accessorKey: 'orderedAt',
        header: ({ column }) => (
          <SortableHeader column={column} title="Tanggal" />
        ),
        cell: ({ row }) => {
          const dateStr = row.original.orderedAt ?? row.original.createdAt
          const date = new Date(dateStr)
          return (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-sm">
                {date.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover/row:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={() => handleViewDetail(row.original)}
              title="Lihat detail pesanan"
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">Lihat detail pesanan</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus pesanan"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus pesanan</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleViewDetail, handleDeleteClick],
  )

  const table = useReactTable({
    data: salesOrders,
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
              Pesanan Penjualan
            </h2>
            <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
              Kelola pesanan penjualan barang kepada pelanggan Anda.
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={handleCreate}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Buat Pesanan
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => handleStatusChange(value as StatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-11">
              <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Dikonfirmasi</SelectItem>
              <SelectItem value="SHIPPED">Dikirim</SelectItem>
              <SelectItem value="DELIVERED">Diterima</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={paymentStatusFilter}
            onValueChange={(value) =>
              handlePaymentStatusChange(value as PaymentStatusFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px] h-11">
              <Package className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status Pembayaran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Pembayaran</SelectItem>
              <SelectItem value="UNPAID">Belum Bayar</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Dibayar Sebagian</SelectItem>
              <SelectItem value="PAID">Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: ClipboardList,
          title: 'Memuat daftar pesanan',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data pesanan Anda ὃb',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar pesanan.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          retryLabel: 'Coba Muat Ulang',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => {
            setStatusFilter('all')
            setPaymentStatusFilter('all')
            setSearchQuery('')
          },
          title: 'Tidak ada pesanan yang sesuai filter 🤔',
          clearLabel: 'Reset Filter',
        }}
        emptyState={{
          icon: ClipboardList,
          title: 'Belum ada pesanan penjualan! 🐻',
          description:
            'Saatnya membuat pesanan penjualan pertama Anda. Kelola penjualan kepada pelanggan dengan lebih terstruktur.',
          ...(canCreate && {
            action: {
              label: 'Buat Pesanan Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari nama pelanggan, email..."
        searchAriaLabel="Cari pesanan"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="pesanan"
      />

      <SalesOrderFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
        isPending={createSalesOrder.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pesanan?"
        description={
          <>
            Anda akan menghapus pesanan dengan ID{' '}
            <span className="font-medium text-foreground">
              #{deletingOrder?.id.slice(0, 8).toUpperCase()}
            </span>
            . Pesanan ini akan dihapus secara permanen dan tidak bisa
            dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteSalesOrder.isPending}
        confirmLabel="Ya, Hapus Pesanan"
      />
    </>
  )
}
