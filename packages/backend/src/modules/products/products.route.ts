import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { productsService } from './products.service'
import { errorResponse } from '@/common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '@/common/pagination'
import { getPublicUrl } from '@/integrations/s3'

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

const productImageSchema = z.object({
  id: z.string(),
  productId: z.string(),
  mediaId: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  media: mediaSchema,
})

const variantImageSchema = z.object({
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

export const productSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
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
})

export const listProductsQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .extend({
    search: z.string().optional(),
  })

export type Product = z.infer<typeof productSchema>
export type ProductVariant = z.infer<typeof variantSchema>
export type CreateProductInput = z.infer<typeof createProductDto>
export type UpdateProductInput = z.infer<typeof updateProductDto>
export type ListProductsQuery = z.infer<typeof listProductsQuery>

const productIdParam = z.object({
  id: z.string().uuid(),
})

const addImageDto = z.object({
  mediaId: z.string(),
  altText: z.string().optional(),
})

const reorderImagesDto = z.object({
  imageIds: z.array(z.string()),
})

const imageIdParam = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
})

export type ProductImage = z.infer<typeof productImageSchema>
export type VariantImage = z.infer<typeof variantImageSchema>

function serializeMedia(m: { createdAt: Date; key: string }) {
  return {
    ...m,
    url: getPublicUrl(m.key),
    createdAt: m.createdAt.toISOString(),
  }
}

function serializeImage(img: {
  createdAt: Date
  media: { createdAt: Date; key: string }
}): ProductImage {
  return {
    ...img,
    createdAt: img.createdAt.toISOString(),
    media: serializeMedia(img.media),
  } as unknown as ProductImage
}

function serializeVariant(v: {
  price: { toNumber: () => number }
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  images: Array<{ createdAt: Date; media: { createdAt: Date; key: string } }>
}): ProductVariant {
  return {
    ...v,
    price: v.price.toNumber(),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    deletedAt: v.deletedAt?.toISOString() ?? null,
    images: v.images.map(serializeImage),
  } as unknown as ProductVariant
}

function serializeProduct(p: {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  variants: Array<{
    price: { toNumber: () => number }
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    images: Array<{ createdAt: Date; media: { createdAt: Date; key: string } }>
  }>
  images: Array<{ createdAt: Date; media: { createdAt: Date; key: string } }>
}): Product {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    deletedAt: p.deletedAt?.toISOString() ?? null,
    variants: p.variants.map(serializeVariant),
    images: p.images.map(serializeImage),
  } as unknown as Product
}

export const productsRoute = new Elysia({
  prefix: '/products',
  tags: ['Products'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await productsService.listProducts(
        organization.id,
        {
          skip,
          take,
          search,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeProduct),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['view'] },
      query: listProductsQuery,
      response: {
        200: paginatedResponse(productSchema),
      },
      detail: {
        summary: 'List products',
        description:
          'Retrieves a paginated list of all products belonging to the authenticated organization.',
      },
    },
  )
  .post(
    '/',
    async ({ organization, body, status }) => {
      const product = await productsService.createProduct(organization.id, body)
      return status(201, serializeProduct(product))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['create'] },
      body: createProductDto,
      response: {
        201: productSchema,
      },
      detail: {
        summary: 'Create a product',
        description:
          'Creates a new product for the authenticated organization.',
      },
    },
  )
  .get(
    '/trashed',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await productsService.listTrashedProducts(
        organization.id,
        {
          skip,
          take,
          search,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeProduct),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['view'] },
      query: listProductsQuery,
      response: {
        200: paginatedResponse(productSchema),
      },
      detail: {
        summary: 'List trashed products',
        description:
          'Retrieves a paginated list of all soft-deleted products belonging to the authenticated organization.',
      },
    },
  )
  .post(
    '/:id/restore',
    async ({ organization, params, status }) => {
      await productsService.restoreProduct(organization.id, params.id)
      return status(200, { message: 'Product restored' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['delete'] },
      params: productIdParam,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: 'Restore a product',
        description: 'Restores a soft-deleted product by its ID.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const product = await productsService.getProduct(
        organization.id,
        params.id,
      )
      if (!product) return status(404, { message: 'Product not found' })
      return serializeProduct(product)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['view'] },
      params: productIdParam,
      response: {
        200: productSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a product',
        description: 'Retrieves the details of a specific product by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ organization, params, body, status }) => {
      const count = await productsService.updateProduct(
        organization.id,
        params.id,
        body,
      )
      if (count.count === 0)
        return status(404, { message: 'Product not found' })
      return status(200, { message: 'Product updated' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['update'] },
      params: productIdParam,
      body: updateProductDto,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a product',
        description: 'Updates the details of an existing product.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ organization, params, status }) => {
      await productsService.deleteProduct(organization.id, params.id)
      return status(200, { message: 'Product deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['delete'] },
      params: productIdParam,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: 'Delete a product',
        description: 'Soft-deletes a product by its ID.',
      },
    },
  )
  .post(
    '/:id/images',
    async ({ organization, params, body, status }) => {
      const image = await productsService.addProductImage(
        organization.id,
        params.id,
        body,
      )
      return status(201, serializeImage(image))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['update'] },
      params: productIdParam,
      body: addImageDto,
      response: {
        201: productImageSchema,
      },
      detail: {
        summary: 'Add image to product',
        description: 'Attaches a media image to a product.',
      },
    },
  )
  .delete(
    '/:id/images/:imageId',
    async ({ organization, params, status }) => {
      await productsService.removeProductImage(
        organization.id,
        params.id,
        params.imageId,
      )
      return status(200, { message: 'Image removed' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['update'] },
      params: imageIdParam,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: 'Remove image from product',
        description: 'Removes an image from a product.',
      },
    },
  )
  .patch(
    '/:id/images/reorder',
    async ({ organization, params, body }) => {
      await productsService.reorderProductImages(
        organization.id,
        params.id,
        body.imageIds,
      )
      return { message: 'Images reordered' }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { product: ['update'] },
      params: productIdParam,
      body: reorderImagesDto,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: 'Reorder product images',
        description: 'Sets the display order of product images.',
      },
    },
  )
