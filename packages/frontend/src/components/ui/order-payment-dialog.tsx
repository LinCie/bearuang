import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import { Banknote, QrCode, Building2, CreditCard, Loader2 } from 'lucide-react'

export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'CARD'

interface OrderPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  remainingAmount: number
  currentPaymentStatus: string
  onConfirm: (data: {
    paymentMethod: PaymentMethod
    amountPaid: number
  }) => void
  isProcessing: boolean
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod
  label: string
  icon: React.ElementType
}> = [
  { value: 'CASH', label: 'Tunai', icon: Banknote },
  { value: 'QRIS', label: 'QRIS', icon: QrCode },
  { value: 'TRANSFER', label: 'Transfer', icon: Building2 },
  { value: 'CARD', label: 'Kartu', icon: CreditCard },
]

export function OrderPaymentDialog({
  open,
  onOpenChange,
  total,
  remainingAmount,
  currentPaymentStatus,
  onConfirm,
  isProcessing,
}: OrderPaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<PaymentMethod | null>(null)
  const [paidAmount, setPaidAmount] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setSelectedMethod(null)
      setPaidAmount('')
    }
  }, [open])

  React.useEffect(() => {
    if (selectedMethod === 'CASH' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedMethod])

  const paid = paidAmount ? parseFloat(paidAmount) : 0

  const maxPayable = remainingAmount
  const isOverpaying = paid > maxPayable && maxPayable > 0
  const isValid = selectedMethod !== null && paid > 0 && !isOverpaying

  function handleConfirm() {
    if (!selectedMethod || !isValid) return
    const effectiveAmount = Math.min(paid, maxPayable)
    onConfirm({
      paymentMethod: selectedMethod,
      amountPaid: effectiveAmount,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            {currentPaymentStatus === 'UNPAID'
              ? 'Catat pembayaran untuk pesanan ini.'
              : `Sisa pembayaran: Rp ${remainingAmount.toLocaleString('id-ID')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex justify-between items-baseline p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Total Pesanan</span>
            <span className="text-lg font-bold tabular-nums">
              Rp {total.toLocaleString('id-ID')}
            </span>
          </div>

          {currentPaymentStatus === 'PARTIALLY_PAID' && (
            <div className="flex justify-between items-baseline p-3 rounded-lg bg-amber-500/10">
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Sisa
              </span>
              <span className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                Rp {remainingAmount.toLocaleString('id-ID')}
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Metode Pembayaran
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon
                const isSelected = selectedMethod === method.value
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setSelectedMethod(method.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedMethod && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="payment-amount" className="mb-1.5 block">
                  Jumlah Dibayar
                </Label>
                <Input
                  ref={inputRef}
                  id="payment-amount"
                  type="number"
                  min="0"
                  max={maxPayable}
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="text-lg font-semibold tabular-nums"
                />
                {maxPayable > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Maks: Rp {maxPayable.toLocaleString('id-ID')}
                  </p>
                )}
              </div>

              {isOverpaying && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  Jumlah melebihi sisa pembayaran.
                </div>
              )}

              {paid > 0 && !isOverpaying && maxPayable > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full tabular-nums"
                  onClick={() => setPaidAmount(String(maxPayable))}
                >
                  Bayar penuh Rp {maxPayable.toLocaleString('id-ID')}
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button disabled={!isValid || isProcessing} onClick={handleConfirm}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Konfirmasi Pembayaran'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
