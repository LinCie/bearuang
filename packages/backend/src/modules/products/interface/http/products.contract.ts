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

export const productImageSchema = z.object({
  id: z.string(),
  productId: z.string(),
  mediaId: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  media: mediaSchema,
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

const categoryBriefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})

export const productSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  categoryId: z.string().nullable(),
  category: categoryBriefSchema.nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  variants: z.array(variantSchema),
  images: z.array(productImageSchema),
})

const slugRegex = /^[a-z0-9_-]+$/

export const createProductDto = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(
      slugRegex,
      'Slug hanya boleh berisi huruf kecil, angka, strip, dan garis bawah',
    ),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

export const updateProductDto = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(
      slugRegex,
      'Slug hanya boleh berisi huruf kecil, angka, strip, dan garis bawah',
    )
    .optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

const productListExtensions = z.object({
  search: z.string().optional(),
  categoryId: z.union([z.string().uuid(), z.literal('null')]).optional(),
})

export const listProductsQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .merge(productListExtensions)

export const productIdParam = z.object({
  id: z.string().uuid(),
})

export const slugParam = z.object({
  slug: z.string().regex(slugRegex),
})

export const addImageDto = z.object({
  mediaId: z.string(),
  altText: z.string().optional(),
})

export const reorderImagesDto = z.object({
  imageIds: z.array(z.string()),
})

export const imageIdParam = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
})

export type Product = z.infer<typeof productSchema>
export type ProductVariant = z.infer<typeof variantSchema>
export type CreateProductInput = z.infer<typeof createProductDto>
export type UpdateProductInput = z.infer<typeof updateProductDto>
export type ListProductsQuery = z.infer<typeof listProductsQuery>
export type ProductImage = z.infer<typeof productImageSchema>
export type VariantImage = z.infer<typeof variantImageSchema>
