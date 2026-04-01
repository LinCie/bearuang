import { useLiveQuery } from 'dexie-react-hooks'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/db'
import { api } from '@/lib/api'
import { variantKeys } from '@/modules/products/hooks/use-variants'
import type { VariantWithProduct } from 'backend/src/modules/variants/variants.route'
import * as React from 'react'

interface PaginatedVariants {
  data: VariantWithProduct[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

interface UseOfflineVariantsOptions {
  search?: string
  page?: number
  pageSize?: number
  orgFilter?: string
}

export function useOfflineVariants(options: UseOfflineVariantsOptions = {}): {
  data: PaginatedVariants | undefined
  isFetching: boolean
  isOffline: boolean
} {
  const { search, page = 1, pageSize = 24, orgFilter } = options
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine)

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const cachedVariants = useLiveQuery(async () => {
    if (!orgFilter) return undefined

    const collection = db.variants.where('organizationId').equals(orgFilter)

    const allVariants = await collection.toArray()

    const filtered = search
      ? allVariants.filter(
          (v) =>
            v.name.toLowerCase().includes(search.toLowerCase()) ||
            v.sku.toLowerCase().includes(search.toLowerCase()),
        )
      : allVariants

    const active = filtered.filter((v) => v.isActive && !v.deletedAt)

    const productMap = new Map<string, string>()
    for (const v of active) {
      if (v.productId && !productMap.has(v.productId)) {
        const product = await db.products.get(v.productId)
        if (product) {
          productMap.set(v.productId, product.name)
        }
      }
    }

    const variantsWithProduct: VariantWithProduct[] = active.map((v) => ({
      id: v.id,
      organizationId: v.organizationId,
      productId: v.productId,
      sku: v.sku,
      name: v.name,
      price: v.price,
      stock: v.stock,
      unit: v.unit,
      attributes: v.attributes,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      deletedAt: v.deletedAt,
      images: [],
      product: { name: productMap.get(v.productId) ?? '' },
    }))

    return variantsWithProduct
  }, [orgFilter, search])

  const queryResult = useQuery({
    queryKey: variantKeys.list({
      search: search ?? undefined,
      page,
      pageSize,
    }),
    queryFn: async () => {
      const { data, error } = await api.variants.get({
        query: {
          page,
          pageSize,
          search: search || undefined,
        },
      })
      if (error) throw error
      return data as PaginatedVariants
    },
    enabled: navigator.onLine,
    staleTime: 1000 * 60 * 5,
  })

  if (queryResult.data) {
    return {
      data: queryResult.data,
      isFetching: queryResult.isFetching,
      isOffline: false,
    }
  }

  if (cachedVariants && cachedVariants.length > 0) {
    const start = (page - 1) * pageSize
    const paged = cachedVariants.slice(start, start + pageSize)
    return {
      data: {
        data: paged,
        meta: {
          page,
          pageSize,
          total: cachedVariants.length,
          totalPages: Math.ceil(cachedVariants.length / pageSize),
        },
      },
      isFetching: false,
      isOffline: true,
    }
  }

  return {
    data: queryResult.data,
    isFetching: queryResult.isFetching,
    isOffline,
  }
}
