import type { VariantRecord, VariantWithProductRecord } from './variant'
import type { VariantImageRecord } from './variant-image'

export type VariantSortField = 'name' | 'sku' | 'price' | 'stock' | 'createdAt'
export type VariantSortOrder = 'asc' | 'desc'

export interface VariantSort {
  field: VariantSortField
  order: VariantSortOrder
}

export interface ListVariantsParams {
  organizationId: string
  skip?: number
  take?: number
  search?: string
  orderBy?: VariantSort
}

export interface ListVariantsResult {
  data: readonly VariantWithProductRecord[]
  total: number
}

export interface ListVariantsByProductParams {
  organizationId: string
  productId: string
}

export interface GetVariantParams {
  organizationId: string
  id: string
}

export interface GetVariantBySkuParams {
  organizationId: string
  sku: string
}

export interface CreateVariantParams {
  organizationId: string
  productId: string
  sku: string
  name: string
  price: number
  unit?: string
  attributes?: Record<string, unknown>
  isActive?: boolean
}

export interface UpdateVariantParams {
  organizationId: string
  id: string
  sku?: string
  name?: string
  price?: number
  unit?: string
  attributes?: Record<string, unknown>
  isActive?: boolean
}

export interface MutateCountResult {
  count: number
}

export interface DeleteVariantParams {
  organizationId: string
  id: string
}

export interface AddVariantImageParams {
  organizationId: string
  variantId: string
  mediaId: string
  altText?: string
}

export interface RemoveVariantImageParams {
  organizationId: string
  variantId: string
  imageId: string
}

export interface VariantRepository {
  list(params: ListVariantsParams): Promise<ListVariantsResult>
  listTrashed(params: ListVariantsParams): Promise<ListVariantsResult>
  listByProduct(params: ListVariantsByProductParams): Promise<VariantRecord[]>
  getById(params: GetVariantParams): Promise<VariantWithProductRecord | null>
  getBySku(
    params: GetVariantBySkuParams,
  ): Promise<VariantWithProductRecord | null>
  create(params: CreateVariantParams): Promise<VariantRecord>
  update(params: UpdateVariantParams): Promise<MutateCountResult>
  softDelete(params: DeleteVariantParams): Promise<void>
  restore(params: DeleteVariantParams): Promise<void>
  addImage(params: AddVariantImageParams): Promise<VariantImageRecord>
  removeImage(params: RemoveVariantImageParams): Promise<MutateCountResult>
}
