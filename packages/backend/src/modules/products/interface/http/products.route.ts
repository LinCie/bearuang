import { Elysia } from 'elysia'
import { errorResponse } from '#common/error.response'
import {
  buildPaginationMeta,
  paginatedResponse,
  paginationToSkipTake,
} from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'
import { authPlugin } from '#plugins/auth.plugin'
import type { ProductsService } from '../../application/products.service'
import {
  addImageDto,
  createProductDto,
  imageIdParam,
  listProductsQuery,
  productIdParam,
  productImageSchema,
  productSchema,
  reorderImagesDto,
  slugParam,
  updateProductDto,
} from './products.contract'
import {
  serializeImage,
  serializeProduct,
} from '../presenters/product.presenter'

interface CreateProductsRouteDependencies {
  productsService: ProductsService
}

export function createProductsRoute({
  productsService,
}: CreateProductsRouteDependencies) {
  return new Elysia({
    prefix: '/products',
    tags: ['Products'],
  })
    .use(authPlugin)
    .get(
      '/',
      async ({ organization, query }) => {
        const { page, pageSize, search, sortBy, sortOrder, categoryId } = query
        const { skip, take } = paginationToSkipTake(page, pageSize)
        const { data, total } = await productsService.listProducts(
          organization.id,
          {
            skip,
            take,
            search,
            categoryId: categoryId === 'null' ? null : categoryId,
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
      async ({ _authType, organization, user, body, status }) => {
        const product = await productsService.createProduct(
          organization.id,
          body,
        )
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Product',
          operation: 'create',
          args: { data: body },
        })
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
      async ({ _authType, organization, user, params, status }) => {
        await productsService.restoreProduct(organization.id, params.id)
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Product',
          operation: 'restore',
          args: { id: params.id },
        })
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
        if (!product) {
          return status(404, { message: 'Product not found' })
        }

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
    .get(
      '/slug/:slug',
      async ({ organization, params, status }) => {
        const product = await productsService.lookupBySlug(
          organization.id,
          params.slug,
        )
        if (!product) {
          return status(404, { message: 'Product not found' })
        }

        return serializeProduct(product)
      },
      {
        requireAuth: true,
        requireOrg: true,
        requirePermission: { product: ['view'] },
        params: slugParam,
        response: {
          200: productSchema,
          404: errorResponse,
        },
        detail: {
          summary: 'Get a product by slug',
          description:
            'Retrieves the details of a specific product by its slug.',
        },
      },
    )
    .patch(
      '/:id',
      async ({ _authType, organization, user, params, body, status }) => {
        const count = await productsService.updateProduct(
          organization.id,
          params.id,
          body,
        )
        if (count.count === 0) {
          return status(404, { message: 'Product not found' })
        }

        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Product',
          operation: 'update',
          args: { id: params.id, data: body },
        })
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
      async ({ _authType, organization, user, params, status }) => {
        await productsService.deleteProduct(organization.id, params.id)
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Product',
          operation: 'delete',
          args: { id: params.id },
        })
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
      async ({ _authType, organization, user, params, body, status }) => {
        const image = await productsService.addProductImage(
          organization.id,
          params.id,
          body,
        )
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'ProductImage',
          operation: 'create',
          args: { productId: params.id, data: body },
        })
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
      async ({ _authType, organization, user, params, status }) => {
        await productsService.removeProductImage(
          organization.id,
          params.id,
          params.imageId,
        )
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'ProductImage',
          operation: 'delete',
          args: { productId: params.id, imageId: params.imageId },
        })
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
      async ({ _authType, organization, user, params, body }) => {
        await productsService.reorderProductImages(
          organization.id,
          params.id,
          body.imageIds,
        )
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'ProductImage',
          operation: 'reorder',
          args: { productId: params.id, imageIds: body.imageIds },
        })
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
}
