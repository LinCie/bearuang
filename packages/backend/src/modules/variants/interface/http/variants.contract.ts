import { z } from 'zod'
import { paginationQuery, sortQuery } from '#common/pagination'

const mediaSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  purpose: z.string().nullable(),
  url: z.string(),
  createdAt: z.iso.datetime(),
})

export const variantImageSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  mediaId: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  media: mediaSchema,
})

export const variantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  organizationId: z.string(),
  sku: z.string(),
  name: z.string(),
  price: z.any(),
  stock: z.number(),
  unit: z.string(),
  attributes: z.any(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  images: z.array(variantImageSchema),
})

export const variantWithProductSchema = variantSchema.extend({
  product: z.object({ name: z.string() }),
})

export const createVariantDto = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export const updateVariantDto = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export const searchVariantQuery = paginationQuery
  .merge(sortQuery(['name', 'sku', 'price', 'stock', 'createdAt']))
  .extend({
    search: z.string().optional(),
  })

const lookupSkuQuery = z.object({
  sku: z.string().min(1),
})

export const variantIdParam = z.object({
  id: z.string().uuid(),
})

const productIdParam = z.object({
  id: z.string().uuid(),
})

const variantImageIdParam = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
})

const addVariantImageDto = z.object({
  mediaId: z.string().min(1),
  altText: z.string().optional(),
})

export type Variant = z.infer<typeof variantSchema>
export type VariantWithProduct = z.infer<typeof variantWithProductSchema>
export type CreateVariantInput = z.infer<typeof createVariantDto>
export type UpdateVariantInput = z.infer<typeof updateVariantDto>
export type SearchVariantQuery = z.infer<typeof searchVariantQuery>
export type VariantImage = z.infer<typeof variantImageSchema>

export {
  variantImageIdParam,
  productIdParam,
  lookupSkuQuery,
  addVariantImageDto,
}
