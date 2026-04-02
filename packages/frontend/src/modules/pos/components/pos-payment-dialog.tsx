import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Banknote, QrCode, Building2, CreditCard } from 'lucide-react'

export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'CARD'

interface PosPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  onConfirm: (paymentMethod: PaymentMethod, paidAmount?: number) => void
  isProcessing: boolean
  error?: string
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

export function PosPaymentDialog({
  open,
  onOpenChange,
  total,
  onConfirm,
  isProcessing,
  error,
}: PosPaymentDialogProps) {
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
  const change = paid - total
  const isCashValid = selectedMethod === 'CASH' && paid >= total

  function handleConfirm() {
    if (!selectedMethod) return
    if (selectedMethod === 'CASH') {
      if (!isCashValid) return
      onConfirm('CASH', paid)
    } else {
      onConfirm(selectedMethod)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold tabular-nums mt-1">
              Rp {total.toLocaleString('id-ID')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Metode Pembayaran
            </p>
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

          {selectedMethod === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Jumlah Dibayar
                </label>
                <Input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="text-lg font-semibold tabular-nums"
                />
              </div>

              {paid > 0 && (
                <div className="flex justify-between items-baseline p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">
                    Kembalian
                  </span>
                  <span
                    className={`text-xl font-bold tabular-nums ${change >= 0 ? 'text-success' : 'text-destructive'}`}
                  >
                    Rp {change.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                {[
                  total,
                  Math.ceil(total / 10000) * 10000,
                  Math.ceil(total / 50000) * 50000,
                ]
                  .filter((v, i, a) => a.indexOf(v) === i && v > 0)
                  .map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs tabular-nums"
                      onClick={() => setPaidAmount(String(amount))}
                    >
                      {amount.toLocaleString('id-ID')}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              disabled={
                !selectedMethod ||
                isProcessing ||
                (selectedMethod === 'CASH' && !isCashValid)
              }
              onClick={handleConfirm}
            >
              {isProcessing ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
