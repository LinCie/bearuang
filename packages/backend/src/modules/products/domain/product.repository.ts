import type { ProductRecord } from './product'
import type { ProductImageRecord } from './product-image'

export interface ProductSort {
  field: 'name' | 'createdAt' | 'updatedAt'
  order: 'asc' | 'desc'
}

export interface ListProductsParams {
  organizationId: string
  skip?: number
  take?: number
  search?: string
  categoryId?: string | null
  categoryIds?: readonly string[]
  orderBy?: ProductSort
}

export interface ListProductsResult {
  data: readonly ProductRecord[]
  total: number
}

export interface GetProductByIdParams {
  organizationId: string
  id: string
}

export interface GetProductBySlugParams {
  organizationId: string
  slug: string
}

export interface CreateProductParams {
  organizationId: string
  name: string
  slug: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

export interface UpdateProductParams {
  organizationId: string
  id: string
  name?: string
  slug?: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

export interface MutateCountResult {
  count: number
}

export interface ProductDeleteParams {
  organizationId: string
  id: string
}

export interface AddProductImageParams {
  organizationId: string
  productId: string
  mediaId: string
  altText?: string
}

export interface RemoveProductImageParams {
  organizationId: string
  productId: string
  imageId: string
}

export interface ReorderProductImagesParams {
  organizationId: string
  productId: string
  imageIds: readonly string[]
}

export interface ProductRepository {
  list(params: ListProductsParams): Promise<ListProductsResult>
  listTrashed(params: ListProductsParams): Promise<ListProductsResult>
  getById(params: GetProductByIdParams): Promise<ProductRecord | null>
  getBySlug(params: GetProductBySlugParams): Promise<ProductRecord | null>
  create(params: CreateProductParams): Promise<ProductRecord>
  update(params: UpdateProductParams): Promise<MutateCountResult>
  softDelete(params: ProductDeleteParams): Promise<void>
  restore(params: ProductDeleteParams): Promise<void>
  addImage(params: AddProductImageParams): Promise<ProductImageRecord>
  removeImage(params: RemoveProductImageParams): Promise<MutateCountResult>
  reorderImages(params: ReorderProductImagesParams): Promise<void>
}
