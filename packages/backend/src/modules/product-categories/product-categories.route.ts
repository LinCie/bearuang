import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { productCategoriesService } from './product-categories.service'
import { productsService } from '@/modules/products/products.service'
import {
  productSchema,
  serializeProduct,
} from '@/modules/products/products.route'
import { errorResponse } from '@/common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '@/common/pagination'
import { logAudit } from '@/libraries/audit-logger'

const categoryChildSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number(),
})

const parentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})

export const productCategorySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  parentId: z.string().nullable(),
  parent: parentSchema.nullable(),
  children: z.array(categoryChildSchema),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  _count: z.object({
    products: z.number(),
  }),
})

const trashedProductCategorySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  parentId: z.string().nullable(),
  parent: parentSchema.nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
})

const slugRegex = /^[a-z0-9_-]+$/

export const createProductCategoryDto = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(
      slugRegex,
      'Slug hanya boleh berisi huruf kecil, angka, strip, dan garis bawah',
    ),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const updateProductCategoryDto = z.object({
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
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const listProductCategoriesQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt', 'sortOrder']))
  .extend({
    search: z.string().optional(),
    parentId: z
      .union([z.string().uuid(), z.literal('null')])
      .transform((v) => (v === 'null' ? null : v))
      .optional(),
  })

export type ProductCategory = z.infer<typeof productCategorySchema>
export type TrashedProductCategory = z.infer<
  typeof trashedProductCategorySchema
>
export type CreateProductCategoryInput = z.infer<
  typeof createProductCategoryDto
>
export type UpdateProductCategoryInput = z.infer<
  typeof updateProductCategoryDto
>
export type ListProductCategoriesQuery = z.infer<
  typeof listProductCategoriesQuery
>

const listCategoryProductsQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .extend({
    search: z.string().optional(),
  })

export type ListCategoryProductsQuery = z.infer<
  typeof listCategoryProductsQuery
>

const categoryIdParam = z.object({
  id: z.string().uuid(),
})

function serializeCategory(c: {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): ProductCategory {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  } as unknown as ProductCategory
}

function serializeTrashedCategory(c: {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): TrashedProductCategory {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  } as unknown as TrashedProductCategory
}

export const productCategoriesRoute = new Elysia({
  prefix: '/product-categories',
  tags: ['Product Categories'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder, parentId } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } =
        await productCategoriesService.listProductCategories(organization.id, {
          skip,
          take,
          search,
          parentId,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        })
      return {
        data: data.map(serializeCategory),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['view'] },
      query: listProductCategoriesQuery,
      response: {
        200: paginatedResponse(productCategorySchema),
      },
      detail: {
        summary: 'List product categories',
        description:
          'Retrieves a paginated list of all product categories belonging to the authenticated organization. Filter by parentId to load tree levels.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      const category = await productCategoriesService.createProductCategory(
        organization.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ProductCategory',
        operation: 'create',
        args: { data: body },
      })
      return status(201, serializeCategory(category))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['create'] },
      body: createProductCategoryDto,
      response: {
        201: productCategorySchema,
      },
      detail: {
        summary: 'Create a product category',
        description:
          'Creates a new product category for the authenticated organization.',
      },
    },
  )
  .get(
    '/trashed',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } =
        await productCategoriesService.listTrashedProductCategories(
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
        data: data.map(serializeTrashedCategory),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['view'] },
      query: paginationQuery
        .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
        .extend({ search: z.string().optional() }),
      response: {
        200: paginatedResponse(trashedProductCategorySchema),
      },
      detail: {
        summary: 'List trashed product categories',
        description:
          'Retrieves a paginated list of all soft-deleted product categories belonging to the authenticated organization.',
      },
    },
  )
  .post(
    '/:id/restore',
    async ({ _authType, organization, user, params, status }) => {
      const result = await productCategoriesService.restoreProductCategory(
        organization.id,
        params.id,
      )
      if (result.count === 0)
        return status(404, { message: 'Category not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ProductCategory',
        operation: 'restore',
        args: { id: params.id },
      })
      return status(200, { message: 'Category restored' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['delete'] },
      params: categoryIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Restore a product category',
        description: 'Restores a soft-deleted product category by its ID.',
      },
    },
  )
  .get(
    '/:id/products',
    async ({ organization, params, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await productsService.listProductsByCategoryTree(
        organization.id,
        params.id,
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
      requirePermission: {
        productCategory: ['view'],
        product: ['view'],
      },
      params: categoryIdParam,
      query: listCategoryProductsQuery,
      response: {
        200: paginatedResponse(productSchema),
      },
      detail: {
        summary: 'List products in category tree',
        description:
          'Retrieves a paginated list of all products belonging to the given category and its descendants (recursive).',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const category = await productCategoriesService.getProductCategory(
        organization.id,
        params.id,
      )
      if (!category) return status(404, { message: 'Category not found' })
      return serializeCategory(category)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['view'] },
      params: categoryIdParam,
      response: {
        200: productCategorySchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a product category',
        description:
          'Retrieves the details of a specific product category by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ _authType, organization, user, params, body, status }) => {
      const count = await productCategoriesService.updateProductCategory(
        organization.id,
        params.id,
        body,
      )
      if (count.count === 0)
        return status(404, { message: 'Category not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ProductCategory',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return status(200, { message: 'Category updated' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['update'] },
      params: categoryIdParam,
      body: updateProductCategoryDto,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a product category',
        description: 'Updates the details of an existing product category.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      await productCategoriesService.deleteProductCategory(
        organization.id,
        params.id,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ProductCategory',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Category deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { productCategory: ['delete'] },
      params: categoryIdParam,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: 'Delete a product category',
        description:
          'Soft-deletes a product category by its ID. Children categories are orphaned (parentId set to null) and linked products have their categoryId cleared.',
      },
    },
  )
