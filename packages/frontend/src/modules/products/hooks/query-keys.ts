import type { ListProductsQuery } from 'backend/src/modules/products/products.route'
import type { SearchVariantQuery } from 'backend/src/modules/variants/variants.route'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: ListProductsQuery) =>
    [...productKeys.lists(), params] as const,
  trashed: () => [...productKeys.all, 'trashed'] as const,
  trashedList: (params: ListProductsQuery) =>
    [...productKeys.trashed(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

export const variantKeys = {
  all: ['variants'] as const,
  lists: () => [...variantKeys.all, 'list'] as const,
  list: (params: SearchVariantQuery) =>
    [...variantKeys.lists(), params] as const,
  details: () => [...variantKeys.all, 'detail'] as const,
  detail: (id: string) => [...variantKeys.details(), id] as const,
  byProduct: (productId: string) =>
    [...variantKeys.all, 'byProduct', productId] as const,
}
