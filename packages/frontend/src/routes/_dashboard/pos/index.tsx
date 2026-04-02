import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePosCart } from '#modules/pos/hooks/use-pos-cart'
import { api } from '#lib/api'
import { useOfflineMutation } from '#hooks/use-offline-mutation'
import {
  getConflictMutations,
  retryMutation,
  discardMutation,
} from '#lib/mutation-queue'
import {
  PosProductSearch,
  PosCart,
  PosCheckoutPanel,
  PosPaymentDialog,
  PosReceipt,
} from '#modules/pos/index'
import type { PaymentMethod } from '#modules/pos/index'
import { SyncStatusBadge } from '#components/ui/sync-status-badge'
import { ConflictDialog } from '#components/ui/conflict-dialog'
import type { MutationQueueItem } from '#lib/db'
import { toast } from 'sonner'
import type { SalesOrder } from '#modules/sales-orders/hooks/use-sales-orders'
import { useQueryClient } from '@tanstack/react-query'
import { salesOrderKeys } from '#modules/sales-orders/hooks/use-sales-orders'
import { variantKeys } from '#modules/products/hooks/use-variants'
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'

export const Route = createFileRoute('/_dashboard/pos/')({
  component: POSPage,
})

interface CreateOrderInput {
  warehouseId: string
  customerId?: string
  guestName: string
  paymentMethod: PaymentMethod
  items: Array<{
    variantId: string
    quantity: number
    unitPrice: number
  }>
}

function POSPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, subtotal } =
    usePosCart()

  const queryClient = useQueryClient()

  const createOrder = useOfflineMutation<CreateOrderInput, SalesOrder>({
    model: 'sales-orders',
    operation: 'create',
    mutationFn: async (input) => {
      const { data, error } = await api['sales-orders'].post(input)
      if (error) throw error
      return data
    },
    invalidateKeys: [
      salesOrderKeys.lists(),
      variantKeys.lists(),
      variantKeys.all,
      auditLogKeys.all,
    ],
    onOnlineSuccess: (order) => {
      for (const item of order.items) {
        queryClient.invalidateQueries({
          queryKey: variantKeys.detail(item.variantId),
        })
      }
    },
  })

  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [createdOrder, setCreatedOrder] = React.useState<SalesOrder | null>(
    null,
  )
  const [lastPaymentMethod, setLastPaymentMethod] =
    React.useState<PaymentMethod | null>(null)
  const [lastPaidAmount, setLastPaidAmount] = React.useState<
    number | undefined
  >()
  const [checkoutData, setCheckoutData] = React.useState<{
    warehouseId: string
    customerId?: string
    guestName: string
  } | null>(null)
  const [paymentError, setPaymentError] = React.useState('')
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false)
  const [conflicts, setConflicts] = React.useState<MutationQueueItem[]>([])

  function handleCheckout(data: {
    warehouseId: string
    customerId?: string
    guestName: string
  }) {
    setCheckoutData(data)
    setPaymentError('')
    setPaymentOpen(true)
  }

  async function handlePaymentConfirm(
    method: PaymentMethod,
    paidAmount?: number,
  ) {
    if (!checkoutData) return

    setPaymentError('')
    setLastPaymentMethod(method)
    setLastPaidAmount(paidAmount)
    setPaymentOpen(false)

    try {
      const result = await createOrder.mutateAsync({
        warehouseId: checkoutData.warehouseId,
        customerId: checkoutData.customerId,
        guestName: checkoutData.guestName || 'Tamu',
        paymentMethod: method,
        items: items.map((item) => ({
          variantId: item.variant.id,
          quantity: item.quantity,
          unitPrice: item.variant.price,
        })),
      })

      if ('tempId' in result) {
        const tempOrder: SalesOrder = {
          id: result.tempId,
          organizationId: '',
          customerId: checkoutData.customerId ?? null,
          customer: null,
          warehouseId: checkoutData.warehouseId,
          warehouse: { id: checkoutData.warehouseId, name: '' },
          guestName: checkoutData.guestName || 'Tamu',
          guestEmail: null,
          shippingAddress: {},
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: method,
          amountPaid: String(subtotal),
          orderedAt: new Date().toISOString(),
          shippedAt: null,
          note: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: items.map((item, i) => ({
            id: `offline-${i}`,
            salesOrderId: result.tempId,
            variantId: item.variant.id,
            variant: {
              id: item.variant.id,
              sku: item.variant.sku,
              name: item.variant.name,
            },
            quantity: item.quantity,
            unitPrice: String(item.variant.price),
          })),
        }
        setCreatedOrder(tempOrder)
        setReceiptOpen(true)
        toast.success('Transaksi disimpan offline. Akan disinkronkan otomatis.')
      } else {
        setCreatedOrder(result)
        setReceiptOpen(true)
        toast.success('Transaksi berhasil!')
      }
    } catch (error) {
      setReceiptOpen(false)
      setPaymentOpen(true)
      setPaymentError(
        error instanceof Error ? error.message : 'Gagal memproses pembayaran',
      )
    }
  }

  function handleNewTransaction() {
    clearCart()
    setCreatedOrder(null)
    setCheckoutData(null)
    setPaymentError('')
  }

  async function handleShowConflicts() {
    const conflictItems = await getConflictMutations()
    setConflicts(conflictItems)
    if (conflictItems.length > 0) {
      setConflictDialogOpen(true)
    }
  }

  async function handleRetryConflict(id: number) {
    await retryMutation(id)
    setConflicts((prev) => prev.filter((c) => c.id !== id))
    createOrder.syncNow()
  }

  async function handleDiscardConflict(id: number) {
    await discardMutation(id)
    setConflicts((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleRetryAll() {
    for (const conflict of conflicts) {
      if (conflict.id != null) {
        await retryMutation(conflict.id)
      }
    }
    setConflicts([])
    setConflictDialogOpen(false)
    createOrder.syncNow()
  }

  async function handleDiscardAll() {
    for (const conflict of conflicts) {
      if (conflict.id != null) {
        await discardMutation(conflict.id)
      }
    }
    setConflicts([])
    setConflictDialogOpen(false)
  }

  React.useEffect(() => {
    function handleOnline() {
      createOrder.syncNow()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [createOrder.syncNow])

  return (
    <div className="relative -mx-4 md:-mx-10 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden lg:border-r lg:border-border/10 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <h1 className="text-xl font-bold text-primary/90">Kasir</h1>
            <SyncStatusBadge onClick={handleShowConflicts} />
          </div>
          <div className="flex-1 min-h-0">
            <PosProductSearch onAddToCart={addItem} cartItems={items} />
          </div>
        </div>

        <div className="w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 border-border/10 bg-primary/[0.02] flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto border-b border-border/10">
            <PosCart
              items={items}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
            />
          </div>
          <div className="shrink-0">
            <PosCheckoutPanel
              items={items}
              subtotal={subtotal}
              onCheckout={handleCheckout}
              onClearCart={clearCart}
              isProcessing={createOrder.isPending}
            />
          </div>
        </div>
      </div>

      <PosPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={subtotal}
        onConfirm={handlePaymentConfirm}
        isProcessing={createOrder.isPending}
        error={paymentError}
        isOffline={createOrder.isOffline}
      />

      <PosReceipt
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        order={createdOrder}
        pendingItems={createdOrder ? undefined : items}
        paymentMethod={lastPaymentMethod ?? 'CASH'}
        paidAmount={lastPaidAmount}
        onNewTransaction={handleNewTransaction}
      />

      <ConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={conflicts}
        onRetry={handleRetryConflict}
        onDiscard={handleDiscardConflict}
        onRetryAll={handleRetryAll}
        onDiscardAll={handleDiscardAll}
      />
    </div>
  )
}
