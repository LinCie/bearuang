import { Elysia } from 'elysia'
import { z } from 'zod'
import { errorResponse } from '#common/error.response'
import {
  buildPaginationMeta,
  paginatedResponse,
  paginationToSkipTake,
} from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'
import { authPlugin } from '#plugins/auth.plugin'
import type { VariantsService } from '../../application/variants.service'
import { variantsService } from '../../application/variants.service'
import {
  createVariantDto,
  lookupSkuQuery,
  productIdParam,
  searchVariantQuery,
  updateVariantDto,
  variantIdParam,
  variantImageIdParam,
  variantSchema,
  variantWithProductSchema,
  addVariantImageDto,
  variantImageSchema,
} from './variants.contract'
export type {
  Variant,
  VariantWithProduct,
  CreateVariantInput,
  UpdateVariantInput,
  SearchVariantQuery,
  VariantImage,
} from './variants.contract'
import {
  serializeVariant,
  serializeVariantImage,
  serializeVariantWithProduct,
} from '../presenters/variant.presenter'

interface CreateVariantsRouteDependencies {
  variantsService: VariantsService
}

export function createVariantsRoute({
  variantsService,
}: CreateVariantsRouteDependencies) {
  return new Elysia({ tags: ['Variants'] })
    .use(authPlugin)
    .group('/products/:id/variants', (app) =>
      app
        .get(
          '/',
          async ({ organization, params }) => {
            const variants = await variantsService.listVariantsByProduct(
              organization.id,
              params.id,
            )
            return variants.map(serializeVariant)
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['view'] },
            params: productIdParam,
            response: {
              200: z.array(variantSchema),
            },
            detail: {
              summary: 'List product variants',
              description:
                'Retrieves all variants belonging to a specific product.',
            },
          },
        )
        .post(
          '/',
          async ({ _authType, organization, user, params, body, status }) => {
            try {
              const variant = await variantsService.createVariant(
                organization.id,
                params.id,
                body,
              )
              void logAudit({
                organizationId: organization.id,
                userId: user.id,
                authType: _authType,
                model: 'ProductVariant',
                operation: 'create',
                args: { productId: params.id, data: body },
              })
              return status(201, serializeVariant(variant))
            } catch (e: unknown) {
              if (e instanceof Error && 'code' in e && e.code === 'P2002') {
                return status(409, {
                  message: `SKU "${body.sku}" already exists in this organization`,
                })
              }
              throw e
            }
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['create'] },
            params: productIdParam,
            body: createVariantDto,
            response: {
              201: variantSchema,
              409: errorResponse,
            },
            detail: {
              summary: 'Create a product variant',
              description: 'Creates a new variant for a specific product.',
            },
          },
        ),
    )
    .group('/variants', (app) =>
      app
        .get(
          '/',
          async ({ organization, query }) => {
            const { page, pageSize, search, sortBy, sortOrder } = query
            const { skip, take } = paginationToSkipTake(page, pageSize)
            const { data, total } = await variantsService.listVariants(
              organization.id,
              {
                search,
                skip,
                take,
                orderBy: sortBy
                  ? { field: sortBy, order: sortOrder ?? 'desc' }
                  : undefined,
              },
            )
            return {
              data: data.map(serializeVariantWithProduct),
              meta: buildPaginationMeta(total, page, pageSize),
            }
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['view'] },
            query: searchVariantQuery,
            response: {
              200: paginatedResponse(variantWithProductSchema),
            },
            detail: {
              summary: 'Search all variants',
              description:
                'Globally search and list variants across the entire organization. Useful for comboboxes and quick lookups.',
            },
          },
        )
        .get(
          '/lookup',
          async ({ organization, query, status }) => {
            const variant = await variantsService.lookupBySku(
              organization.id,
              query.sku,
            )
            if (!variant) return status(404, { message: 'Variant not found' })
            return serializeVariantWithProduct(variant)
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['view'] },
            query: lookupSkuQuery,
            response: {
              200: variantWithProductSchema,
              404: errorResponse,
            },
            detail: {
              summary: 'Lookup variant by SKU',
              description:
                'Quickly find a variant by its exact SKU. Used for barcode scanning in POS.',
            },
          },
        )
        .get(
          '/trashed',
          async ({ organization, query }) => {
            const { page, pageSize, search, sortBy, sortOrder } = query
            const { skip, take } = paginationToSkipTake(page, pageSize)
            const { data, total } = await variantsService.listTrashedVariants(
              organization.id,
              {
                search,
                skip,
                take,
                orderBy: sortBy
                  ? { field: sortBy, order: sortOrder ?? 'desc' }
                  : undefined,
              },
            )
            return {
              data: data.map(serializeVariantWithProduct),
              meta: buildPaginationMeta(total, page, pageSize),
            }
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['view'] },
            query: searchVariantQuery,
            response: {
              200: paginatedResponse(variantWithProductSchema),
            },
            detail: {
              summary: 'List trashed variants',
              description:
                'Retrieves a paginated list of all soft-deleted variants.',
            },
          },
        )
        .post(
          '/:id/restore',
          async ({ _authType, organization, user, params, status }) => {
            await variantsService.restoreVariant(organization.id, params.id)
            void logAudit({
              organizationId: organization.id,
              userId: user.id,
              authType: _authType,
              model: 'ProductVariant',
              operation: 'restore',
              args: { id: params.id },
            })
            return status(200, { message: 'Variant restored' })
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['delete'] },
            params: variantIdParam,
            response: {
              200: errorResponse,
            },
            detail: {
              summary: 'Restore a variant',
              description: 'Restores a soft-deleted variant by its ID.',
            },
          },
        )
        .get(
          '/:id',
          async ({ organization, params, status }) => {
            const variant = await variantsService.getVariant(
              organization.id,
              params.id,
            )
            if (!variant) return status(404, { message: 'Variant not found' })
            return serializeVariantWithProduct(variant)
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['view'] },
            params: variantIdParam,
            response: {
              200: variantWithProductSchema,
              404: errorResponse,
            },
            detail: {
              summary: 'Get a variant',
              description:
                'Retrieves the details of a specific variant by its ID.',
            },
          },
        )
        .patch(
          '/:id',
          async ({ _authType, organization, user, params, body, status }) => {
            try {
              const count = await variantsService.updateVariant(
                organization.id,
                params.id,
                body,
              )
              if (count.count === 0)
                return status(404, { message: 'Variant not found' })
              void logAudit({
                organizationId: organization.id,
                userId: user.id,
                authType: _authType,
                model: 'ProductVariant',
                operation: 'update',
                args: { id: params.id, data: body },
              })
              return status(200, { message: 'Variant updated' })
            } catch (e: unknown) {
              if (e instanceof Error && 'code' in e && e.code === 'P2002') {
                return status(409, {
                  message: `SKU "${body.sku}" already exists in this organization`,
                })
              }
              throw e
            }
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['update'] },
            params: variantIdParam,
            body: updateVariantDto,
            response: {
              200: errorResponse,
              404: errorResponse,
              409: errorResponse,
            },
            detail: {
              summary: 'Update a variant',
              description: 'Updates the details of an existing variant.',
            },
          },
        )
        .delete(
          '/:id',
          async ({ _authType, organization, user, params, status }) => {
            await variantsService.deleteVariant(organization.id, params.id)
            void logAudit({
              organizationId: organization.id,
              userId: user.id,
              authType: _authType,
              model: 'ProductVariant',
              operation: 'delete',
              args: { id: params.id },
            })
            return status(200, { message: 'Variant deleted' })
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['delete'] },
            params: variantIdParam,
            response: {
              200: errorResponse,
            },
            detail: {
              summary: 'Delete a variant',
              description: 'Soft-deletes a product variant by its ID.',
            },
          },
        )
        .post(
          '/:id/images',
          async ({ _authType, organization, user, params, body, status }) => {
            const image = await variantsService.addVariantImage(
              organization.id,
              params.id,
              body,
            )
            void logAudit({
              organizationId: organization.id,
              userId: user.id,
              authType: _authType,
              model: 'VariantImage',
              operation: 'create',
              args: { variantId: params.id, data: body },
            })
            return status(201, serializeVariantImage(image))
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['update'] },
            params: variantIdParam,
            body: addVariantImageDto,
            response: {
              201: variantImageSchema,
            },
            detail: {
              summary: 'Add image to variant',
              description: 'Attaches a media image to a variant.',
            },
          },
        )
        .delete(
          '/:id/images/:imageId',
          async ({ _authType, organization, user, params, status }) => {
            await variantsService.removeVariantImage(
              organization.id,
              params.id,
              params.imageId,
            )
            void logAudit({
              organizationId: organization.id,
              userId: user.id,
              authType: _authType,
              model: 'VariantImage',
              operation: 'delete',
              args: { variantId: params.id, imageId: params.imageId },
            })
            return status(200, { message: 'Image removed' })
          },
          {
            requireAuth: true,
            requireOrg: true,
            requirePermission: { productVariant: ['update'] },
            params: variantImageIdParam,
            response: {
              200: errorResponse,
            },
            detail: {
              summary: 'Remove image from variant',
              description: 'Removes an image from a variant.',
            },
          },
        ),
    )
}

export const variantsRoute = createVariantsRoute({ variantsService })
