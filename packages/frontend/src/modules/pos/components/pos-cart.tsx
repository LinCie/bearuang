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
      className="p-2 space-y-2 max-h-[25vh] lg:max-h-none overflow-y-auto"
      role="region"
      aria-label="Keranjang"
      aria-live="polite"
    >
      {items.map((item) => {
        const lineTotal = item.variant.price * item.quantity
        return (
          <div
            key={item.variant.id}
            className="grid grid-cols-[auto_1fr] gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            {/* Left column - Small image */}
            <div className="w-12 h-12 shrink-0 rounded-md bg-muted/50 overflow-hidden">
              {item.variant.images[0]?.media?.url ? (
                <img
                  src={item.variant.images[0].media.url}
                  alt={item.variant.images[0].altText || item.variant.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Right column - 2 rows */}
            <div className="flex flex-col justify-between min-w-0">
              {/* Top row - Product name */}
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {item.variant.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.variant.product.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-40 focus-visible:opacity-100 hover:opacity-100 transition-opacity text-destructive hover:text-destructive -mt-0.5 -mr-0.5"
                  onClick={() => onRemoveItem(item.variant.id)}
                  aria-label={`Hapus ${item.variant.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              {/* Bottom row - Quantity controls and price */}
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      onUpdateQuantity(item.variant.id, item.quantity - 1)
                    }
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      onUpdateQuantity(item.variant.id, item.quantity + 1)
                    }
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <p className="text-xs font-semibold tabular-nums text-primary">
                  Rp {lineTotal.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
