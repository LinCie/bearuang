import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { warehousesService } from './warehouses.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const warehouseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const createWarehouseDto = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const updateWarehouseDto = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const listWarehousesQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .extend({
    search: z.string().optional(),
  })

export type Warehouse = z.infer<typeof warehouseSchema>
export type CreateWarehouseInput = z.infer<typeof createWarehouseDto>
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseDto>
export type ListWarehousesQuery = z.infer<typeof listWarehousesQuery>

const warehouseIdParam = z.object({
  id: z.string().uuid(),
})

const serializeWarehouse = (w: {
  id: string
  organizationId: string
  name: string
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  ...w,
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
})

export const warehousesRoute = new Elysia({
  prefix: '/warehouses',
  tags: ['Warehouses'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await warehousesService.listWarehouses(
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
        data: data.map(serializeWarehouse),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { warehouse: ['view'] },
      query: listWarehousesQuery,
      response: {
        200: paginatedResponse(warehouseSchema),
      },
      detail: {
        summary: 'List warehouses',
        description:
          'Retrieves a paginated list of all warehouses belonging to the authenticated organization.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      const warehouse = await warehousesService.createWarehouse(
        organization.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Warehouse',
        operation: 'create',
        args: { data: body },
      })
      return status(201, serializeWarehouse(warehouse))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { warehouse: ['create'] },
      body: createWarehouseDto,
      response: {
        201: warehouseSchema,
      },
      detail: {
        summary: 'Create a warehouse',
        description:
          'Creates a new warehouse for the authenticated organization.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const warehouse = await warehousesService.getWarehouse(
        organization.id,
        params.id,
      )
      if (!warehouse) return status(404, { message: 'Warehouse not found' })
      return serializeWarehouse(warehouse)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { warehouse: ['view'] },
      params: warehouseIdParam,
      response: {
        200: warehouseSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a warehouse',
        description: 'Retrieves the details of a specific warehouse by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ _authType, organization, user, params, body, status }) => {
      const count = await warehousesService.updateWarehouse(
        organization.id,
        params.id,
        body,
      )
      if (count.count === 0)
        return status(404, { message: 'Warehouse not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Warehouse',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return status(200, { message: 'Warehouse updated' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { warehouse: ['update'] },
      params: warehouseIdParam,
      body: updateWarehouseDto,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a warehouse',
        description: 'Updates the details of an existing warehouse.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      const count = await warehousesService.deleteWarehouse(
        organization.id,
        params.id,
      )
      if (count.count === 0)
        return status(404, { message: 'Warehouse not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Warehouse',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Warehouse deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { warehouse: ['delete'] },
      params: warehouseIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a warehouse',
        description: 'Permanently deletes a warehouse by its ID.',
      },
    },
  )
