import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import * as React from 'react'
import {
  Package,
  Calendar,
  CheckCircle,
  ArrowLeft,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Truck,
  User,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '#components/ui/sheet'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import { Textarea } from '#components/ui/textarea'
import { Skeleton } from '#components/ui/skeleton'
import {
  useSalesOrder,
  useUpdateSalesOrder,
  useDeleteSalesOrder,
  LargeStatusBadge,
  PaymentStatusBadge,
  formatRupiah,
} from '#modules/sales-orders/index'
import { useStockMovementsByReference } from '#modules/stock-movements/index'
import type {
  SalesOrder,
  UpdateSalesOrderInput,
} from '#modules/sales-orders/index'
import type { StockMovementType } from '#modules/stock-movements/index'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/sales-orders/$salesOrderId')({
  component: SalesOrderDetailPage,
})

// ─── Loading State ────────────────────────────────────────────

function SalesOrderLoadingState() {
  return (
    <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Content Skeleton */}
      <section className="flex flex-col gap-10">
        <Skeleton className="h-32 w-full max-w-2xl rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </section>
    </main>
  )
}

// ─── Error State ──────────────────────────────────────────────

function SalesOrderErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Gagal memuat data pesanan penjualan
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Terjadi kesalahan saat mengambil data. Silakan coba lagi atau hubungi
          admin jika masalah berlanjut.
        </p>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      </div>
    </main>
  )
}

// ─── Page Component ───────────────────────────────────────────

function SalesOrderDetailPage() {
  const { salesOrderId } = Route.useParams()
  const router = useRouter()
  const canUpdate = useHasPermission('salesOrder:update')
  const {
    data: salesOrder,
    isLoading,
    isError,
    refetch,
  } = useSalesOrder(salesOrderId)

  // Mutations
  const updateSalesOrder = useUpdateSalesOrder()
  const deleteSalesOrder = useDeleteSalesOrder()

  // Dialog/Sheet state
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [shipDialogOpen, setShipDialogOpen] = React.useState(false)

  // Edit form state
  const [editForm, setEditForm] = React.useState({
    note: '',
    orderedAt: '',
    shippedAt: '',
  })

  // Initialize edit form when data loads
  React.useEffect(() => {
    if (salesOrder) {
      setEditForm({
        note: salesOrder.note ?? '',
        orderedAt: salesOrder.orderedAt
          ? new Date(salesOrder.orderedAt).toISOString().slice(0, 16)
          : '',
        shippedAt: salesOrder.shippedAt
          ? new Date(salesOrder.shippedAt).toISOString().slice(0, 16)
          : '',
      })
    }
  }, [salesOrder])

  // ─── Handlers ──────────────────────────────────────────────

  const handleBack = React.useCallback(() => {
    router.navigate({ to: '/sales-orders' })
  }, [router])

  const handleEdit = React.useCallback(() => {
    setEditSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!salesOrder) return
    await deleteSalesOrder.mutateAsync(salesOrder.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/sales-orders' })
  }, [salesOrder, deleteSalesOrder, router])

  const handleEditSubmit = React.useCallback(async () => {
    if (!salesOrder) return
    const input: UpdateSalesOrderInput & { id: string } = {
      id: salesOrder.id,
      note: editForm.note || undefined,
      orderedAt: editForm.orderedAt || undefined,
      shippedAt: editForm.shippedAt || undefined,
    }
    await updateSalesOrder.mutateAsync(input)
    setEditSheetOpen(false)
  }, [salesOrder, editForm, updateSalesOrder])

  const handleConfirmOrder = React.useCallback(async () => {
    if (!salesOrder) return
    await updateSalesOrder.mutateAsync({
      id: salesOrder.id,
      status: 'CONFIRMED',
    })
  }, [salesOrder, updateSalesOrder])

  const handleShipOrder = React.useCallback(async () => {
    if (!salesOrder) return
    await updateSalesOrder.mutateAsync({
      id: salesOrder.id,
      status: 'SHIPPED',
      shippedAt: new Date().toISOString(),
    })
    setShipDialogOpen(false)
  }, [salesOrder, updateSalesOrder])

  const handleDeliverOrder = React.useCallback(async () => {
    if (!salesOrder) return
    await updateSalesOrder.mutateAsync({
      id: salesOrder.id,
      status: 'DELIVERED',
    })
  }, [salesOrder, updateSalesOrder])

  const handleCompleteOrder = React.useCallback(async () => {
    if (!salesOrder) return
    await updateSalesOrder.mutateAsync({
      id: salesOrder.id,
      status: 'COMPLETED',
    })
  }, [salesOrder, updateSalesOrder])

  const handlePaymentStatusChange = React.useCallback(
    async (status: SalesOrder['paymentStatus']) => {
      if (!salesOrder) return
      await updateSalesOrder.mutateAsync({
        id: salesOrder.id,
        paymentStatus: status,
      })
    },
    [salesOrder, updateSalesOrder],
  )

  // ─── Stock Movements Query ─────────────────────────────────

  const { data: stockMovements, isLoading: isLoadingMovements } =
    useStockMovementsByReference(salesOrder?.id ?? '', 'sales_order')

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <SalesOrderLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !salesOrder) {
    return <SalesOrderErrorState onRetry={() => refetch()} />
  }

  const so = salesOrder

  // Calculate totals
  const totalAmount = so.items.reduce((sum, item) => {
    return sum + item.quantity * parseFloat(item.unitPrice)
  }, 0)

  // Determine available actions
  const canDelete = so.status === 'PENDING'
  const canConfirm = so.status === 'PENDING'
  const canShip = so.status === 'CONFIRMED'
  const canDeliver = so.status === 'SHIPPED'
  const canComplete = so.status === 'DELIVERED'

  // ─── Helpers ───────────────────────────────────────────────

  function getMovementTypeLabel(type: StockMovementType) {
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

  function getMovementTypeBadgeStyles(type: StockMovementType) {
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

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl font-semibold text-foreground">
                  SO {so.id.slice(0, 8).toUpperCase()}
                </h1>
                <LargeStatusBadge status={so.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                ID: {so.id.slice(0, 8)}...{so.id.slice(-4)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            )}
            {canUpdate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}

            {(canConfirm || canShip || canDeliver || canComplete) && (
              <div className="w-px h-6 bg-border mx-2 hidden sm:block" />
            )}

            {canConfirm && (
              <Button
                size="sm"
                onClick={handleConfirmOrder}
                disabled={updateSalesOrder.isPending}
                className="gap-2"
              >
                {updateSalesOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Konfirmasi
              </Button>
            )}
            {canShip && (
              <Button
                size="sm"
                onClick={() => setShipDialogOpen(true)}
                className="gap-2"
              >
                <Truck className="h-4 w-4" />
                Kirim Barang
              </Button>
            )}
            {canDeliver && (
              <Button
                size="sm"
                onClick={handleDeliverOrder}
                disabled={updateSalesOrder.isPending}
                className="gap-2"
              >
                {updateSalesOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Tandai Diterima
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                onClick={handleCompleteOrder}
                disabled={updateSalesOrder.isPending}
                className="gap-2"
              >
                {updateSalesOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Selesaikan
              </Button>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col gap-12 sm:gap-16">
          {/* Sales Order Summary Section */}
          <section className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-foreground">
              Ringkasan Pesanan
            </h2>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <LargeStatusBadge status={so.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">
                    Total Pesanan & Status Pembayaran
                  </dt>
                  <dd className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold text-foreground">
                      {formatRupiah(totalAmount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full ring-offset-background transition-opacity hover:opacity-80">
                        <PaymentStatusBadge status={so.paymentStatus} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => handlePaymentStatusChange('UNPAID')}
                          disabled={
                            updateSalesOrder.isPending ||
                            so.paymentStatus === 'UNPAID'
                          }
                        >
                          Belum Bayar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handlePaymentStatusChange('PARTIALLY_PAID')
                          }
                          disabled={
                            updateSalesOrder.isPending ||
                            so.paymentStatus === 'PARTIALLY_PAID'
                          }
                        >
                          Dibayar Sebagian
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePaymentStatusChange('PAID')}
                          disabled={
                            updateSalesOrder.isPending ||
                            so.paymentStatus === 'PAID'
                          }
                        >
                          Lunas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">
                    Total Item
                  </dt>
                  <dd className="text-lg font-medium text-foreground">
                    {so.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                    unit
                  </dd>
                </div>
              </div>
            </div>
          </section>

          {/* Customer Information */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Pelanggan
            </h2>
            <div className="flex flex-col gap-2">
              {so.customer ? (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: so.customer.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {so.customer.name}
                  </Link>
                </div>
              ) : so.guestName ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{so.guestName}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Tamu
                    </span>
                  </div>
                  {so.guestEmail && (
                    <p className="text-sm text-muted-foreground ml-6">
                      {so.guestEmail}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Tanpa Nama</p>
              )}
            </div>
          </section>

          {/* Logistics Information */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Logistik
            </h2>
            <p className="text-base text-foreground leading-relaxed">
              Pengiriman dari{' '}
              <Link
                to="/warehouses/$warehouseId"
                params={{ warehouseId: so.warehouse.id }}
                className="font-medium text-primary hover:underline"
                title={so.warehouse.name}
              >
                {so.warehouse.name}
              </Link>
              .
            </p>
          </section>

          {/* Items Table */}
          <section className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-foreground">
              Item Pesanan
            </h2>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Harga Satuan</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {so.items.map((item) => {
                    const subtotal = item.quantity * parseFloat(item.unitPrice)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div
                            className="max-w-[200px] line-clamp-2 wrap-break-word"
                            title={item.variant.name}
                          >
                            {item.variant.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[120px]">
                            <span
                              className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block max-w-[100px] truncate"
                              title={item.variant.sku}
                            >
                              {item.variant.sku}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(parseFloat(item.unitPrice))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatRupiah(subtotal)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={4} className="text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Stock Movements Section */}
          <section className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-foreground">
              Riwayat Stok
            </h2>
            {isLoadingMovements ? (
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
            ) : stockMovements?.data && stockMovements.data.length > 0 ? (
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Gudang</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements.data.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(movement.createdAt).toLocaleDateString(
                            'id-ID',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/products/$productId"
                            params={{ productId: movement.variant.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {movement.variant.name}
                          </Link>
                          <div className="text-xs text-muted-foreground font-mono">
                            {movement.variant.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {movement.warehouse.name}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getMovementTypeBadgeStyles(movement.type)}`}
                          >
                            {getMovementTypeLabel(movement.type)}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            movement.type === 'OUT'
                              ? 'text-rose-600 dark:text-rose-400'
                              : movement.type === 'IN'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                          }`}
                        >
                          {movement.type === 'OUT' ? '-' : '+'}
                          {movement.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada pergerakan stok untuk pesanan penjualan ini.
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Dates Section */}
            <section className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-foreground">
                Tanggal
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Tanggal Pesan
                  </dt>
                  <dd className="text-sm text-foreground">
                    {so.orderedAt ? (
                      new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(so.orderedAt))
                    ) : (
                      <span className="text-muted-foreground italic">
                        Belum ditentukan
                      </span>
                    )}
                  </dd>
                </div>
                {so.shippedAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Tanggal Kirim
                    </dt>
                    <dd className="text-sm text-foreground">
                      {new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(so.shippedAt))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Notes Section */}
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Catatan
              </h2>
              {so.note ? (
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap wrap-break-word max-w-3xl bg-muted/30 p-4 rounded-lg">
                  {so.note}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Tidak ada catatan untuk pesanan penjualan ini.
                </p>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-2xl">Edit Pesanan Penjualan</SheetTitle>
            <SheetDescription className="text-base mt-1 text-balance">
              Ubah detail pesanan penjualan. Klik simpan ketika selesai.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="orderedAt">Tanggal Pesan</Label>
              <Input
                id="orderedAt"
                type="datetime-local"
                value={editForm.orderedAt}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    orderedAt: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="shippedAt">Tanggal Kirim</Label>
              <Input
                id="shippedAt"
                type="datetime-local"
                value={editForm.shippedAt}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    shippedAt: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">Catatan</Label>
              <Textarea
                id="note"
                value={editForm.note}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Tambahkan catatan untuk pesanan ini..."
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setEditSheetOpen(false)}
              disabled={updateSalesOrder.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={updateSalesOrder.isPending}
            >
              {updateSalesOrder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Hapus pesanan penjualan?
            </DialogTitle>
            <DialogDescription>
              Anda akan menghapus pesanan penjualan{' '}
              <span className="font-medium text-foreground">
                SO {so.id.slice(0, 8).toUpperCase()}
              </span>
              . Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteSalesOrder.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteSalesOrder.isPending}
            >
              {deleteSalesOrder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus Pesanan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Confirmation Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Kirim Barang?
            </DialogTitle>
            <DialogDescription>
              Tandai pesanan penjualan{' '}
              <span className="font-medium text-foreground">
                SO {so.id.slice(0, 8).toUpperCase()}
              </span>{' '}
              sebagai sudah dikirim dan catat tanggal pengiriman.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tanggal pengiriman akan dicatat sebagai:{' '}
              <span className="font-medium text-foreground">
                {new Date().toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShipDialogOpen(false)}
              disabled={updateSalesOrder.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleShipOrder}
              disabled={updateSalesOrder.isPending}
            >
              {updateSalesOrder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Ya, Kirim Barang'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
