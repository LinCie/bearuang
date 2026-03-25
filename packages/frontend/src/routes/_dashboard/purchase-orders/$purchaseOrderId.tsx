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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useReceivePurchaseOrder,
  LargeStatusBadge,
  PaymentStatusBadge,
  formatRupiah,
} from '@/modules/purchase-orders'
import type {
  PurchaseOrder,
  UpdatePurchaseOrderInput,
} from '@/modules/purchase-orders'

export const Route = createFileRoute(
  '/_dashboard/purchase-orders/$purchaseOrderId',
)({
  component: PurchaseOrderDetailPage,
})

// ─── Loading State ────────────────────────────────────────────

function PurchaseOrderLoadingState() {
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

function PurchaseOrderErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Gagal memuat data pesanan pembelian
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

function PurchaseOrderDetailPage() {
  const { purchaseOrderId } = Route.useParams()
  const router = useRouter()
  const {
    data: purchaseOrder,
    isLoading,
    isError,
    refetch,
  } = usePurchaseOrder(purchaseOrderId)

  // Mutations
  const updatePurchaseOrder = useUpdatePurchaseOrder()
  const deletePurchaseOrder = useDeletePurchaseOrder()
  const receivePurchaseOrder = useReceivePurchaseOrder()

  // Dialog/Sheet state
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = React.useState(false)

  // Edit form state
  const [editForm, setEditForm] = React.useState({
    note: '',
    orderedAt: '',
  })

  // Receive items state
  const [receiveItems, setReceiveItems] = React.useState<
    Array<{ itemId: string; receivedQty: number }>
  >([])

  // Initialize edit form when data loads
  React.useEffect(() => {
    if (purchaseOrder) {
      setEditForm({
        note: purchaseOrder.note ?? '',
        orderedAt: purchaseOrder.orderedAt
          ? new Date(purchaseOrder.orderedAt).toISOString().slice(0, 16)
          : '',
      })
    }
  }, [purchaseOrder])

  // Initialize receive items when dialog opens
  React.useEffect(() => {
    if (purchaseOrder && receiveDialogOpen) {
      setReceiveItems(
        purchaseOrder.items.map((item) => ({
          itemId: item.id,
          receivedQty: 0,
        })),
      )
    }
  }, [purchaseOrder, receiveDialogOpen])

  // ─── Handlers ──────────────────────────────────────────────

  const handleBack = React.useCallback(() => {
    router.navigate({ to: '/purchase-orders' })
  }, [router])

  const handleEdit = React.useCallback(() => {
    setEditSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!purchaseOrder) return
    await deletePurchaseOrder.mutateAsync(purchaseOrder.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/purchase-orders' })
  }, [purchaseOrder, deletePurchaseOrder, router])

  const handleEditSubmit = React.useCallback(async () => {
    if (!purchaseOrder) return
    const input: UpdatePurchaseOrderInput & { id: string } = {
      id: purchaseOrder.id,
      note: editForm.note || undefined,
      orderedAt: editForm.orderedAt || undefined,
    }
    await updatePurchaseOrder.mutateAsync(input)
    setEditSheetOpen(false)
  }, [purchaseOrder, editForm, updatePurchaseOrder])

  const handleConfirmOrder = React.useCallback(async () => {
    if (!purchaseOrder) return
    await updatePurchaseOrder.mutateAsync({
      id: purchaseOrder.id,
      status: 'CONFIRMED',
    })
  }, [purchaseOrder, updatePurchaseOrder])

  const handleCompleteOrder = React.useCallback(async () => {
    if (!purchaseOrder) return
    await updatePurchaseOrder.mutateAsync({
      id: purchaseOrder.id,
      status: 'COMPLETED',
    })
  }, [purchaseOrder, updatePurchaseOrder])

  const handleReceiveSubmit = React.useCallback(async () => {
    if (!purchaseOrder) return
    await receivePurchaseOrder.mutateAsync({
      id: purchaseOrder.id,
      items: receiveItems.map((item) => ({
        itemId: item.itemId,
        receivedQty: item.receivedQty,
      })),
    })
    setReceiveDialogOpen(false)
  }, [purchaseOrder, receiveItems, receivePurchaseOrder])

  const handlePaymentStatusChange = React.useCallback(
    async (status: PurchaseOrder['paymentStatus']) => {
      if (!purchaseOrder) return
      await updatePurchaseOrder.mutateAsync({
        id: purchaseOrder.id,
        paymentStatus: status,
      })
    },
    [purchaseOrder, updatePurchaseOrder],
  )

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <PurchaseOrderLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !purchaseOrder) {
    return <PurchaseOrderErrorState onRetry={() => refetch()} />
  }

  const po = purchaseOrder

  // Calculate totals
  const totalAmount = po.items.reduce((sum, item) => {
    return sum + item.quantity * parseFloat(item.unitCost)
  }, 0)

  const totalReceived = po.items.reduce((sum, item) => {
    return sum + item.receivedQty
  }, 0)

  const totalOrdered = po.items.reduce((sum, item) => {
    return sum + item.quantity
  }, 0)

  // Determine available actions
  const canDelete = po.status === 'PENDING'
  const canConfirm = po.status === 'PENDING'
  const canReceive = po.status === 'CONFIRMED' || po.status === 'SHIPPED'
  const canComplete = po.status === 'RECEIVED'

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
                  PO {po.id.slice(0, 8).toUpperCase()}
                </h1>
                <LargeStatusBadge status={po.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                ID: {po.id.slice(0, 8)}...{po.id.slice(-4)}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>

            {(canConfirm || canReceive || canComplete) && (
              <div className="w-px h-6 bg-border mx-2 hidden sm:block" />
            )}

            {canConfirm && (
              <Button
                size="sm"
                onClick={handleConfirmOrder}
                disabled={updatePurchaseOrder.isPending}
                className="gap-2"
              >
                {updatePurchaseOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Konfirmasi
              </Button>
            )}
            {canReceive && (
              <Button
                size="sm"
                onClick={() => setReceiveDialogOpen(true)}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Terima Barang
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                onClick={handleCompleteOrder}
                disabled={updatePurchaseOrder.isPending}
                className="gap-2"
              >
                {updatePurchaseOrder.isPending ? (
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
          {/* Purchase Order Summary Section */}
          <section className="flex flex-col gap-5">
            <h2 className="text-base font-semibold text-foreground">
              Ringkasan Pesanan
            </h2>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <LargeStatusBadge status={po.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">
                    Total Pesanan & Status
                  </dt>
                  <dd className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold text-foreground">
                      {formatRupiah(totalAmount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full ring-offset-background transition-opacity hover:opacity-80">
                        <PaymentStatusBadge status={po.paymentStatus} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => handlePaymentStatusChange('UNPAID')}
                          disabled={
                            updatePurchaseOrder.isPending ||
                            po.paymentStatus === 'UNPAID'
                          }
                        >
                          Belum Bayar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handlePaymentStatusChange('PARTIALLY_PAID')
                          }
                          disabled={
                            updatePurchaseOrder.isPending ||
                            po.paymentStatus === 'PARTIALLY_PAID'
                          }
                        >
                          Dibayar Sebagian
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePaymentStatusChange('PAID')}
                          disabled={
                            updatePurchaseOrder.isPending ||
                            po.paymentStatus === 'PAID'
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
                    Progress Penerimaan
                  </dt>
                  <dd className="text-lg font-medium text-foreground">
                    {totalReceived} / {totalOrdered} unit
                    <span className="text-sm text-muted-foreground ml-2">
                      ({Math.round((totalReceived / totalOrdered) * 100) || 0}
                      %)
                    </span>
                  </dd>
                </div>
              </div>
            </div>
          </section>

          {/* Logistics Information */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Logistik
            </h2>
            <p className="text-base text-foreground leading-relaxed">
              Pemesanan dari{' '}
              <Link
                to="/suppliers/$supplierId"
                params={{ supplierId: po.supplier.id }}
                className="font-medium text-primary hover:underline"
                title={po.supplier.name}
              >
                {po.supplier.name}
              </Link>{' '}
              dikirim ke{' '}
              <Link
                to="/warehouses/$warehouseId"
                params={{ warehouseId: po.warehouse.id }}
                className="font-medium text-primary hover:underline"
                title={po.warehouse.name}
              >
                {po.warehouse.name}
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
                    <TableHead className="text-right">Diterima</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item) => {
                    const subtotal = item.quantity * parseFloat(item.unitCost)
                    const receiveProgress =
                      item.quantity > 0
                        ? (item.receivedQty / item.quantity) * 100
                        : 0
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
                          {formatRupiah(parseFloat(item.unitCost))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`text-xs ${
                                item.receivedQty >= item.quantity
                                  ? 'text-primary font-medium'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {item.receivedQty}/{item.quantity}
                            </span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  receiveProgress >= 100
                                    ? 'bg-primary'
                                    : 'bg-primary/70'
                                }`}
                                style={{
                                  width: `${Math.min(receiveProgress, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatRupiah(subtotal)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={5} className="text-right">
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
                    {po.orderedAt ? (
                      new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(po.orderedAt))
                    ) : (
                      <span className="text-muted-foreground italic">
                        Belum ditentukan
                      </span>
                    )}
                  </dd>
                </div>
                {po.receivedAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      Tanggal Diterima
                    </dt>
                    <dd className="text-sm text-foreground">
                      {new Intl.DateTimeFormat('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(po.receivedAt))}
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
              {po.note ? (
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap wrap-break-word max-w-3xl bg-muted/30 p-4 rounded-lg">
                  {po.note}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Tidak ada catatan untuk pesanan pembelian ini.
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
            <SheetTitle>Edit Pesanan Pembelian</SheetTitle>
            <SheetDescription>
              Ubah detail pesanan pembelian. Klik simpan ketika selesai.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 py-6">
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
              disabled={updatePurchaseOrder.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={updatePurchaseOrder.isPending}
            >
              {updatePurchaseOrder.isPending ? (
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
              Hapus pesanan pembelian?
            </DialogTitle>
            <DialogDescription>
              Anda akan menghapus pesanan pembelian{' '}
              <span className="font-medium text-foreground">
                PO {po.id.slice(0, 8).toUpperCase()}
              </span>
              . Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletePurchaseOrder.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletePurchaseOrder.isPending}
            >
              {deletePurchaseOrder.isPending ? (
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

      {/* Receive Items Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Terima Barang
            </DialogTitle>
            <DialogDescription>
              Masukkan jumlah barang yang diterima untuk setiap item.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Dipesan</TableHead>
                  <TableHead className="text-right">Sudah Diterima</TableHead>
                  <TableHead className="text-right">
                    Diterima Sekarang
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item, index) => {
                  const remaining = item.quantity - item.receivedQty
                  const currentValue = receiveItems.find(
                    (ri) => ri.itemId === item.id,
                  )?.receivedQty
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div
                          className="font-medium max-w-[200px] line-clamp-2 wrap-break-word"
                          title={item.variant.name}
                        >
                          {item.variant.name}
                        </div>
                        <div
                          className="text-xs text-muted-foreground font-mono max-w-[150px] truncate"
                          title={item.variant.sku}
                        >
                          {item.variant.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.receivedQty}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          aria-label={`Jumlah diterima untuk ${item.variant.name}`}
                          min={0}
                          max={remaining}
                          value={currentValue ?? 0}
                          onChange={(e) => {
                            const value = Math.min(
                              Math.max(0, parseInt(e.target.value) || 0),
                              remaining,
                            )
                            setReceiveItems((prev) =>
                              prev.map((ri, i) =>
                                i === index
                                  ? { ...ri, receivedQty: value }
                                  : ri,
                              ),
                            )
                          }}
                          className="w-24 text-right inline-block"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveDialogOpen(false)}
              disabled={receivePurchaseOrder.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={handleReceiveSubmit}
              disabled={
                receivePurchaseOrder.isPending ||
                receiveItems.every((item) => item.receivedQty === 0)
              }
            >
              {receivePurchaseOrder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Konfirmasi Penerimaan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
