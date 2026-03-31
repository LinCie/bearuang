import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CartItem } from '../hooks/use-pos-cart'

interface PosCartProps {
  items: CartItem[]
  onUpdateQuantity: (variantId: string, quantity: number) => void
  onRemoveItem: (variantId: string) => void
}

export function PosCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
}: PosCartProps) {
  if (!items.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
        <ShoppingCart className="w-12 h-12 opacity-30" />
        <p className="text-sm">Keranjang kosong</p>
        <p className="text-xs opacity-60">
          Scan barcode atau cari produk untuk memulai
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-y-auto space-y-1"
      role="region"
      aria-label="Keranjang"
      aria-live="polite"
    >
      {items.map((item) => {
        const lineTotal = item.variant.price * item.quantity
        return (
          <div
            key={item.variant.id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {item.variant.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.variant.product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Rp {item.variant.price.toLocaleString('id-ID')} x{' '}
                {item.quantity}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                onClick={() =>
                  onUpdateQuantity(item.variant.id, item.quantity - 1)
                }
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                onClick={() =>
                  onUpdateQuantity(item.variant.id, item.quantity + 1)
                }
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="text-right w-24 shrink-0">
              <p className="text-sm font-semibold tabular-nums">
                Rp {lineTotal.toLocaleString('id-ID')}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-11 opacity-40 focus-visible:opacity-100 hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={() => onRemoveItem(item.variant.id)}
              aria-label={`Hapus ${item.variant.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
