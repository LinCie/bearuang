import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { db } from '@/lib/db'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'

export function useVariantLookup() {
  const [isLooking, setIsLooking] = useState(false)

  const lookupBySku = useCallback(async (sku: string) => {
    setIsLooking(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await api.variants.lookup.get({
          query: { sku },
        })
        if (!error) return data as unknown as VariantWithProduct
      }

      const variant = await db.variants.where('sku').equals(sku).first()
      if (!variant) return null

      const product = variant.productId
        ? await db.products.get(variant.productId)
        : null

      return {
        id: variant.id,
        organizationId: variant.organizationId,
        productId: variant.productId,
        sku: variant.sku,
        name: variant.name,
        price: variant.price,
        stock: variant.stock,
        unit: variant.unit,
        attributes: variant.attributes,
        isActive: variant.isActive,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        deletedAt: variant.deletedAt,
        images: [],
        product: { name: product?.name ?? '' },
      } satisfies VariantWithProduct
    } catch {
      return null
    } finally {
      setIsLooking(false)
    }
  }, [])

  return { lookupBySku, isLooking }
}
