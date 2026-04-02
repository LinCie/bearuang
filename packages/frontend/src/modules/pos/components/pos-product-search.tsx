import * as React from 'react'
import { Search, ScanBarcode } from 'lucide-react'
import { Input } from '#components/ui/input'
import { useOfflineVariants } from '../hooks/use-offline-variants'
import { useVariantLookup } from '../hooks/use-variant-lookup'
import type { CartItem } from '../hooks/use-pos-cart'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'
import { useSession } from '#lib/auth-client'

interface PosProductSearchProps {
  onAddToCart: (variant: VariantWithProduct) => void
  cartItems: CartItem[]
}

export function PosProductSearch({
  onAddToCart,
  cartItems,
}: PosProductSearchProps) {
  const [search, setSearch] = React.useState('')
  const barcodeBuffer = React.useRef('')
  const barcodeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const { lookupBySku, isLooking } = useVariantLookup()
  const { data: sessionData } = useSession()
  const orgId = sessionData
    ? (sessionData.session.activeOrganizationId ?? undefined)
    : undefined

  React.useEffect(() => {
    return () => {
      if (barcodeTimer.current) {
        clearTimeout(barcodeTimer.current)
      }
    }
  }, [])

  const { data: variantsData, isFetching } = useOfflineVariants({
    search: search || undefined,
    page: 1,
    pageSize: 24,
    orgFilter: orgId,
  })

  const variants = variantsData?.data ?? []
  const cartVariantIds = new Set(cartItems.map((i) => i.variant.id))

  function handleBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const key = e.key
    if (key === 'Enter') {
      e.preventDefault()
      const scannedValue = barcodeBuffer.current.trim()
      barcodeBuffer.current = ''

      if (barcodeTimer.current) {
        clearTimeout(barcodeTimer.current)
        barcodeTimer.current = null
      }

      if (scannedValue) {
        handleSkuLookup(scannedValue)
      }
      return
    }

    if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
      barcodeBuffer.current += key
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
      barcodeTimer.current = setTimeout(() => {
        barcodeBuffer.current = ''
      }, 200)
    }
  }

  async function handleSkuLookup(sku: string) {
    const variant = await lookupBySku(sku)
    if (variant) {
      onAddToCart(variant)
      setSearch('')
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleBarcodeKey}
          placeholder="Cari produk atau scan barcode..."
          aria-label="Cari produk atau scan barcode"
          className="pl-10 pr-10"
        />
        <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        {isLooking && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 overflow-y-auto content-start">
        {isFetching &&
          !variants.length &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => onAddToCart(variant)}
            className="relative text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all duration-150 group cursor-pointer flex flex-col"
          >
            {cartVariantIds.has(variant.id) && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center z-10">
                {cartItems.find((i) => i.variant.id === variant.id)?.quantity}
              </span>
            )}
            <div className="aspect-square w-full rounded-md bg-muted/50 overflow-hidden mb-2">
              {variant.images[0]?.media?.url ? (
                <img
                  src={variant.images[0].media.url}
                  alt={variant.images[0].altText || variant.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                  <svg
                    className="w-8 h-8"
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
            <p className="text-[10px] font-medium text-muted-foreground/70 truncate">
              {variant.product.name}
            </p>
            <p className="text-xs font-semibold truncate mt-0.5 leading-tight">
              {variant.name}
            </p>
            <p className="text-xs font-bold text-primary mt-1">
              Rp {variant.price.toLocaleString('id-ID')}
            </p>
            <p
              className={`text-[10px] mt-0.5 ${variant.stock > 0 ? 'text-success' : 'text-destructive'}`}
            >
              Stok: {variant.stock}
            </p>
          </button>
        ))}
        {!isFetching && search && !variants.length && (
          <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
            Tidak ada produk ditemukan
          </div>
        )}
      </div>
    </div>
  )
}
