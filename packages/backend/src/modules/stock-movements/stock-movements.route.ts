import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { stockMovementService } from './stock-movements.service'
import { StockMovementType as PrismaStockMovementType } from '#generated/prisma/client'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const movementTypeEnum = z.enum([
  PrismaStockMovementType.IN,
  PrismaStockMovementType.OUT,
  PrismaStockMovementType.ADJUSTMENT,
])

export const stockMovementSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  variantId: z.string(),
  type: movementTypeEnum,
  quantity: z.number(),
  referenceId: z.string().nullable(),
  referenceType: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

export const stockMovementWithRelationsSchema = stockMovementSchema.extend({
  variant: z.object({ id: z.string(), sku: z.string(), name: z.string() }),
  warehouse: z.object({ id: z.string(), name: z.string() }),
})

export const createMovementDto = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().positive(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  note: z.string().optional(),
})

export const listMovementsQuery = paginationQuery
  .merge(sortQuery(['createdAt', 'quantity', 'type']))
  .extend({
    search: z.string().optional(),
    variantId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    type: movementTypeEnum.optional(),
    referenceId: z.string().optional(),
    referenceType: z.string().optional(),
  })

export type StockMovementType = z.infer<typeof movementTypeEnum>
export type StockMovement = z.infer<typeof stockMovementSchema>
export type StockMovementWithRelations = z.infer<
  typeof stockMovementWithRelationsSchema
>
export type CreateMovementInput = z.infer<typeof createMovementDto>
export type ListMovementsQuery = z.infer<typeof listMovementsQuery>

const movementIdParam = z.object({
  id: z.string().uuid(),
})

const serializeMovement = (m: {
  id: string
  organizationId: string
  warehouseId: string
  variantId: string
  type: StockMovementType
  quantity: number
  referenceId: string | null
  referenceType: string | null
  note: string | null
  createdAt: Date
  variant: { id: string; sku: string; name: string }
  warehouse: { id: string; name: string }
}) => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
})

export const stockMovementRoute = new Elysia({
  prefix: '/stock-movements',
  tags: ['Stock Movements'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const {
        page,
        pageSize,
        search,
        variantId,
        warehouseId,
        type,
        referenceId,
        referenceType,
        sortBy,
        sortOrder,
      } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await stockMovementService.listMovements(
        organization.id,
        {
          skip,
          take,
          search,
          variantId,
          warehouseId,
          type,
          referenceId,
          referenceType,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeMovement),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ['view'] },
      query: listMovementsQuery,
      response: {
        200: paginatedResponse(stockMovementWithRelationsSchema),
      },
      detail: {
        summary: 'List stock movements',
        description:
          'Retrieves a paginated list of stock movements for the authenticated organization. Supports filtering by variant, warehouse, and movement type.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      const movement = await stockMovementService.createMovement(
        organization.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'StockMovement',
        operation: 'create',
        args: { data: body },
      })
      return status(201, serializeMovement(movement))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ['adjust'] },
      body: createMovementDto,
      response: {
        201: stockMovementWithRelationsSchema,
      },
      detail: {
        summary: 'Create a stock movement',
        description:
          "Records a new stock movement (IN, OUT, or ADJUSTMENT) and atomically updates the variant's stock cache.",
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const movement = await stockMovementService.getMovement(
        organization.id,
        params.id,
      )
      if (!movement) return status(404, { message: 'Stock movement not found' })
      return serializeMovement(movement)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ['view'] },
      params: movementIdParam,
      response: {
        200: stockMovementWithRelationsSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a stock movement',
        description:
          'Retrieves the details of a specific stock movement by its ID.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      const deleted = await stockMovementService.deleteMovement(
        organization.id,
        params.id,
      )
      if (!deleted) return status(404, { message: 'Stock movement not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'StockMovement',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Stock movement deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ['adjust'] },
      params: movementIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a stock movement',
        description:
          'Deletes a stock movement and reverses its effect on the variant stock cache atomically.',
      },
    },
  )
