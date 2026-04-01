import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePosCart } from '@/modules/pos/hooks/use-pos-cart'
import { useCreateSalesOrder } from '@/modules/sales-orders/hooks/use-sales-orders'
import {
  PosProductSearch,
  PosCart,
  PosCheckoutPanel,
  PosPaymentDialog,
  PosReceipt,
} from '@/modules/pos'
import type { PaymentMethod } from '@/modules/pos'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/pos/')({
  component: POSPage,
})

function POSPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, subtotal } =
    usePosCart()

  const createOrder = useCreateSalesOrder()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [receiptOpen, setReceiptOpen] = React.useState(false)
  const [createdOrder, setCreatedOrder] = React.useState<
    typeof createOrder.data | null
  >(null)
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
    setReceiptOpen(true)

    try {
      const order = await createOrder.mutateAsync({
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

      setCreatedOrder(order)
      toast.success('Transaksi berhasil!')
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

  return (
    <div className="relative -mx-4 md:-mx-10 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden lg:border-r lg:border-border/10 min-h-0">
          <h1 className="text-xl font-bold shrink-0 text-primary/90">Kasir</h1>
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
      />

      <PosReceipt
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        order={createdOrder ?? null}
        pendingItems={createdOrder ? undefined : items}
        paymentMethod={lastPaymentMethod ?? 'CASH'}
        paidAmount={lastPaidAmount}
        onNewTransaction={handleNewTransaction}
      />
    </div>
  )
}
