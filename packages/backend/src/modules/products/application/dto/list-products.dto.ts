import type {
  ListProductsParams,
  ListProductsResult,
  ProductSort,
} from '../../domain/product.repository'

export type { ListProductsResult, ProductSort }

export type ListProductsInput = Pick<
  ListProductsParams,
  'organizationId' | 'skip' | 'take' | 'search' | 'categoryId' | 'orderBy'
>

export interface ListProductsByCategoryTreeInput extends Pick<
  ListProductsParams,
  'organizationId' | 'skip' | 'take' | 'search' | 'orderBy'
> {
  rootCategoryId: string
}
