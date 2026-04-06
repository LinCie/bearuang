import * as React from 'react'
import { ScanBarcode, ShoppingCart } from 'lucide-react'
import { Input } from '#components/ui/input'
import { useBarcodeScanner } from '../hooks/use-barcode-scanner'
import type { CartItem } from '../hooks/use-pos-cart'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'

interface PosBarcodeScannerProps {
  onAddToCart: (variant: VariantWithProduct) => void
  cartItems: CartItem[]
}

interface ScannedEntry {
  id: string
  name: string
  sku: string
  price: number
}

export function PosBarcodeScanner({
  onAddToCart,
  cartItems,
}: PosBarcodeScannerProps) {
  const { inputRef, handleInputChange, isLooking, focus } = useBarcodeScanner({
    onAddToCart,
  })
  const [scannedLog, setScannedLog] = React.useState<ScannedEntry[]>([])

  const prevItemCountRef = React.useRef(
    cartItems.reduce((s, i) => s + i.quantity, 0),
  )

  React.useEffect(() => {
    const newCount = cartItems.reduce((s, i) => s + i.quantity, 0)
    if (newCount > prevItemCountRef.current && cartItems.length > 0) {
      const lastItem = cartItems[cartItems.length - 1]
      setScannedLog((prev) =>
        [
          {
            id: lastItem.variant.id,
            name: lastItem.variant.name,
            sku: lastItem.variant.sku,
            price: lastItem.variant.price,
          },
          ...prev,
        ].slice(0, 5),
      )
    }
    prevItemCountRef.current = newCount
  }, [cartItems])

  React.useEffect(() => {
    focus()
  }, [focus])

  React.useEffect(() => {
    if (!isLooking) {
      requestAnimationFrame(() => focus())
    }
  }, [isLooking, focus])

  React.useEffect(() => {
    const onBlur = () => {
      setTimeout(focus, 50)
    }
    const el = inputRef.current
    el?.addEventListener('blur', onBlur)
    return () => {
      el?.removeEventListener('blur', onBlur)
    }
  }, [inputRef, focus])

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="relative shrink-0">
        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
        <Input
          ref={inputRef}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Pindai barcode..."
          aria-label="Pindai barcode"
          className="pl-12 pr-10 h-14 text-lg font-mono"
          disabled={isLooking}
        />
        {isLooking && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {scannedLog.length > 0 && (
          <div className="flex flex-col gap-1 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground/70 px-1">
              Terakhir dipindai
            </p>
            {scannedLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-muted/30"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {entry.sku}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary ml-2 shrink-0">
                  Rp {entry.price.toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        )}

        {scannedLog.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground/50 py-12">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-sm">Siap memindai produk</p>
            <p className="text-xs text-muted-foreground/40">
              Arahkan barcode ke scanner atau ketik SKU
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
