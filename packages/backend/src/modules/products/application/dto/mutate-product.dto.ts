export interface CreateProductInput {
  organizationId: string
  name: string
  slug: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

export interface UpdateProductInput {
  organizationId: string
  id: string
  name?: string
  slug?: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

export interface ProductIdentityInput {
  organizationId: string
  id: string
}

export interface AddProductImageInput {
  organizationId: string
  productId: string
  mediaId: string
  altText?: string
}

export interface RemoveProductImageInput {
  organizationId: string
  productId: string
  imageId: string
}

export interface ReorderProductImagesInput {
  organizationId: string
  productId: string
  imageIds: readonly string[]
}
