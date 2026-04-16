import type { VariantImageRecord } from './variant-image'

export interface DecimalLike {
  toNumber(): number
}

export interface VariantRecord {
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

export interface VariantWithProductRecord extends VariantRecord {
  product: { name: string }
}
