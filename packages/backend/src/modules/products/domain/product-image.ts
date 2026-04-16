export interface MediaRecord {
  id: string
  organizationId: string
  key: string
  filename: string
  contentType: string
  size: number
  purpose: string | null
  createdAt: Date
}

export interface ProductImageRecord {
  id: string
  productId: string
  mediaId: string
  altText: string | null
  sortOrder: number
  createdAt: Date
  media: MediaRecord
}

export interface VariantImageRecord {
  id: string
  variantId: string
  mediaId: string
  altText: string | null
  sortOrder: number
  createdAt: Date
  media: MediaRecord
}
