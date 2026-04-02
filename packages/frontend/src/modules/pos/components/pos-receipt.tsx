import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Printer, RotateCcw, Loader2 } from 'lucide-react'
import type { SalesOrder } from '#modules/sales-orders/hooks/use-sales-orders'
import type { CartItem } from '../hooks/use-pos-cart'
import type { PaymentMethod } from './pos-payment-dialog'

interface PosReceiptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: SalesOrder | null
  pendingItems?: CartItem[]
  paymentMethod: PaymentMethod
  paidAmount?: number
  onNewTransaction: () => void
}

export function PosReceipt({
  open,
  onOpenChange,
  order,
  pendingItems,
  paymentMethod,
  paidAmount,
  onNewTransaction,
}: PosReceiptProps) {
  const isLoading = !order && !!pendingItems?.length

  const displayItems = order
    ? order.items.map((item) => ({
        id: item.id,
        name: item.variant.name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
      }))
    : (pendingItems?.map((item) => ({
        id: item.variant.id,
        name: item.variant.name,
        quantity: item.quantity,
        unitPrice: item.variant.price,
      })) ?? [])

  const total = displayItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const change = paidAmount ? paidAmount - total : 0

  function handlePrint() {
    window.print()
  }

  function handleNewTransaction() {
    onOpenChange(false)
    onNewTransaction()
  }

  const paymentMethodLabel: Record<PaymentMethod, string> = {
    CASH: 'Tunai',
    QRIS: 'QRIS',
    TRANSFER: 'Transfer',
    CARD: 'Kartu',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm print:max-w-none print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Transaksi Berhasil</DialogTitle>
        </DialogHeader>

        <div
          id="pos-receipt"
          className="font-mono text-xs leading-relaxed print:text-[10px]"
        >
          <div className="text-center space-y-1 mb-4">
            <p className="text-base font-bold print:text-sm">BearUang</p>
            <p className="text-[10px] text-muted-foreground">
              {order
                ? new Date(order.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })
                : new Date().toLocaleString('id-ID', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })}
            </p>
          </div>

          {order && (
            <div className="border-t border-dashed border-border/50 pt-2 mb-2">
              <p className="text-[10px] text-muted-foreground">
                No: {order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="border-t border-dashed border-border/50 py-2 space-y-1 mb-2">
            {displayItems.map((item) => (
              <div key={item.id} className="flex justify-between">
                <div className="flex-1 min-w-0">
                  <p className="truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.quantity} x Rp{' '}
                    {item.unitPrice.toLocaleString('id-ID')}
                  </p>
                </div>
                <p className="shrink-0 ml-2 tabular-nums">
                  Rp {(item.unitPrice * item.quantity).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-border/50 pt-2 space-y-1 mb-4">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span className="tabular-nums">
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Metode</span>
              <span>{paymentMethodLabel[paymentMethod]}</span>
            </div>
            {paymentMethod === 'CASH' && paidAmount !== undefined && (
              <>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Dibayar</span>
                  <span className="tabular-nums">
                    Rp {paidAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                {change > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>Kembalian</span>
                    <span className="tabular-nums">
                      Rp {change.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-dashed border-border/50">
            <p>Terima kasih atas kunjungan Anda!</p>
          </div>
        </div>

        <div className="flex gap-2 print:hidden mt-4">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handlePrint}
            disabled={isLoading}
          >
            <Printer className="w-4 h-4" />
            Cetak Struk
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleNewTransaction}
            disabled={isLoading}
          >
            <RotateCcw className="w-4 h-4" />
            Transaksi Baru
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
