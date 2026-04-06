import { useRef, useCallback } from 'react'
import { useVariantLookup } from './use-variant-lookup'
import { toast } from 'sonner'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'

interface UseBarcodeScannerOptions {
  onAddToCart: (variant: VariantWithProduct) => void
}

export function useBarcodeScanner({ onAddToCart }: UseBarcodeScannerOptions) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isQueryInFlight = useRef(false)
  const { lookupBySku, isLooking } = useVariantLookup()

  const focus = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const handleInputChange = useCallback(
    (value: string) => {
      if (isQueryInFlight.current || !value) return

      isQueryInFlight.current = true
      const sku = value.trim()

      lookupBySku(sku)
        .then((variant) => {
          if (variant) {
            onAddToCart(variant)
          } else {
            toast.error(`Produk tidak ditemukan: ${sku}`)
          }
        })
        .catch(() => {
          toast.error(`Produk tidak ditemukan: ${sku}`)
        })
        .finally(() => {
          isQueryInFlight.current = false
          if (inputRef.current) {
            inputRef.current.value = ''
          }
          focus()
        })
    },
    [lookupBySku, onAddToCart, focus],
  )

  return { inputRef, handleInputChange, isLooking, focus }
}
