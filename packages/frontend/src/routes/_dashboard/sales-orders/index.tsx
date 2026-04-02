import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  Plus,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ClipboardList,
  SearchX,
  ChevronLeft,
  Sparkles,
  Package,
  Building2,
  Calendar,
  Clock,
  User,
  Search,
  Eye,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { useHasPermission } from '#lib/use-permissions'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table'

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

// ─── Types ────────────────────────────────────────────────────

type StatusFilter =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'all'

type PaymentStatusFilter = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'all'

// ─── Route Definition ─────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────

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

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Delete dialog state
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

  // Sync URL with filter state
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

  // ─── Handlers ──────────────────────────────────────────────

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

  // ─── Table Columns ─────────────────────────────────────────

  const columns = React.useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            ID
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        ),
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
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Tanggal
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
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

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Page Header & Toolbar */}
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Filter */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama pelanggan, email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          {/* Status Filter */}
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

          {/* Payment Status Filter */}
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

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={columns.length} className="py-20">
                  <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="relative mb-8 mt-4 group">
                      <div
                        className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl animate-pulse"
                        style={{ animationDuration: '3s' }}
                      />
                      <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-50/80 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">
                        <ClipboardList
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
                          Memuat daftar pesanan
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
                        Tunggu sebentar ya, kami sedang mengambil data pesanan
                        Anda ὃb
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-16"
                >
                  <p className="text-destructive font-medium text-lg">
                    Aduh, gagal memuat daftar pesanan.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
                    Sepertinya ada sedikit kendala jaringan. Mari kita coba
                    sekali lagi.
                  </p>
                  <Button
                    variant="outline"
                    className="px-6"
                    onClick={() => window.location.reload()}
                  >
                    Coba Muat Ulang
                  </Button>
                </TableCell>
              </TableRow>
            ) : salesOrders.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24 whitespace-normal"
                >
                  {statusFilter !== 'all' ||
                  paymentStatusFilter !== 'all' ||
                  searchQuery ? (
                    <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative mb-8 group cursor-default">
                        <div className="absolute inset-0 bg-stone-100/80 dark:bg-stone-900/40 rounded-full blur-2xl group-hover:bg-stone-200/80 transition-colors duration-500" />

                        <div className="relative flex items-center justify-center">
                          <div className="absolute -top-3 -right-3 h-8 w-8 text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500 delay-100">
                            <SearchX className="h-full w-full" />
                          </div>

                          <div className="relative h-20 w-20 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800/50 flex items-center justify-center rotate-3 group-hover:rotate-12 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 shadow-sm group-hover:shadow-md cursor-help">
                            <ClipboardList className="h-8 w-8 text-stone-400 dark:text-stone-500 transition-transform duration-500 group-hover:scale-95 group-hover:opacity-80" />
                            <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:rotate-[-15deg] transition-all duration-500 delay-75">
                              <SearchX className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-medium text-foreground mb-3 transition-colors duration-500 group-hover:text-stone-700 dark:group-hover:text-stone-300 whitespace-normal">
                        Tidak ada pesanan yang sesuai filter 🤔
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                        Kami tidak menemukan pesanan penjualan yang sesuai
                        dengan filter yang Anda pilih.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setStatusFilter('all')
                            setPaymentStatusFilter('all')
                            setSearchQuery('')
                          }}
                          className="px-8 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
                        >
                          Reset Filter
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative mb-10 group cursor-default">
                        {/* Decorative background blur to add warmth */}
                        <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />

                        {/* Main icon arrangement */}
                        <div className="relative flex items-center justify-center">
                          {/* Sparkles! */}
                          <div className="absolute -top-6 -left-2 h-6 w-6 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-3 group-hover:-rotate-12 transition-all duration-700 delay-100">
                            <Sparkles className="h-full w-full" />
                          </div>
                          <div className="absolute bottom-0 -right-8 h-5 w-5 text-orange-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-500 delay-200">
                            <Sparkles className="h-full w-full" />
                          </div>

                          <div className="absolute -left-6 top-1 h-14 w-14 rounded-2xl bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center -rotate-12 group-hover:-rotate-25 group-hover:-translate-x-3 group-hover:-translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md">
                            <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="absolute -right-5 -bottom-2 h-12 w-12 rounded-xl bg-orange-100/90 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800/60 flex items-center justify-center rotate-12 group-hover:rotate-25 group-hover:translate-x-3 group-hover:translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md delay-75">
                            <Plus className="h-6 w-6 text-orange-700 dark:text-orange-400" />
                          </div>

                          <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                            <ClipboardList
                              className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                              strokeWidth={1.5}
                            />
                          </div>
                        </div>
                      </div>

                      <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                        Belum ada pesanan penjualan! 🐻
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                        Saatnya membuat pesanan penjualan pertama Anda. Kelola
                        penjualan kepada pelanggan dengan lebih terstruktur.
                      </p>
                      {canCreate && (
                        <Button
                          onClick={handleCreate}
                          size="lg"
                          className="px-8 h-12 text-base shadow-sm hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
                        >
                          <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                          <span className="relative flex items-center font-medium">
                            <Plus className="mr-2 h-5 w-5" />
                            Buat Pesanan Pertama
                          </span>
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
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
            pesanan
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
      <SalesOrderFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
        isPending={createSalesOrder.isPending}
      />

      {/* Delete Confirmation Dialog */}
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
