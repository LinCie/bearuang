export interface CreateVariantInput {
  organizationId: string
  productId: string
  sku: string
  name: string
  price: number
  unit?: string
  attributes?: Record<string, unknown>
  isActive?: boolean
}

export interface UpdateVariantInput {
  organizationId: string
  id: string
  sku?: string
  name?: string
  price?: number
  unit?: string
  attributes?: Record<string, unknown>
  isActive?: boolean
}

export interface VariantIdentityInput {
  organizationId: string
  id: string
}

export interface AddVariantImageInput {
  organizationId: string
  variantId: string
  mediaId: string
  altText?: string
}

export interface RemoveVariantImageInput {
  organizationId: string
  variantId: string
  imageId: string
}
