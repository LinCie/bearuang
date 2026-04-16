import type { ProductImageRecord, VariantImageRecord } from './product-image'

export interface DecimalLike {
  toNumber(): number
}

export interface ProductCategoryBrief {
  id: string
  name: string
  slug: string
}

export interface ProductVariantRecord {
  id: string
  productId: string
  organizationId: string
  sku: string
  name: string
  price: DecimalLike
  stock: number
  unit: string
  attributes: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  images: readonly VariantImageRecord[]
}

export interface ProductRecord {
  id: string
  organizationId: string
  categoryId: string | null
  category: ProductCategoryBrief | null
  name: string
  slug: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  variants: readonly ProductVariantRecord[]
  images: readonly ProductImageRecord[]
}
