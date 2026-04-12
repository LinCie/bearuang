import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { suppliersService } from './suppliers.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const supplierSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const createSupplierDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const updateSupplierDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const supplierListExtensions = z.object({
  search: z.string().optional(),
  isActive: z.union([z.literal('true'), z.literal('false')]).optional(),
})

export const listSuppliersQuery = paginationQuery
  .merge(sortQuery(['name', 'createdAt', 'updatedAt']))
  .merge(supplierListExtensions)

export type Supplier = z.infer<typeof supplierSchema>
export type CreateSupplierInput = z.infer<typeof createSupplierDto>
export type UpdateSupplierInput = z.infer<typeof updateSupplierDto>
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuery>

const supplierIdParam = z.object({
  id: z.string().uuid(),
})

const serializeSupplier = (s: {
  id: string
  organizationId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  ...s,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
})

export const suppliersRoute = new Elysia({
  prefix: '/suppliers',
  tags: ['Suppliers'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, isActive, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await suppliersService.listSuppliers(
        organization.id,
        {
          skip,
          take,
          search,
          isActive:
            isActive === 'true'
              ? true
              : isActive === 'false'
                ? false
                : undefined,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeSupplier),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { supplier: ['view'] },
      query: listSuppliersQuery,
      response: {
        200: paginatedResponse(supplierSchema),
      },
      detail: {
        summary: 'List suppliers',
        description:
          'Retrieves a paginated list of suppliers for the authenticated organization. Supports filtering by active status and sorting.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      const supplier = await suppliersService.createSupplier(
        organization.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Supplier',
        operation: 'create',
        args: { data: body },
      })
      return status(201, serializeSupplier(supplier))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { supplier: ['create'] },
      body: createSupplierDto,
      response: {
        201: supplierSchema,
      },
      detail: {
        summary: 'Create a supplier',
        description:
          'Creates a new supplier for the authenticated organization.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const supplier = await suppliersService.getSupplier(
        organization.id,
        params.id,
      )
      if (!supplier) return status(404, { message: 'Supplier not found' })
      return serializeSupplier(supplier)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { supplier: ['view'] },
      params: supplierIdParam,
      response: {
        200: supplierSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a supplier',
        description: 'Retrieves the details of a specific supplier by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ _authType, organization, user, params, body, status }) => {
      const supplier = await suppliersService.updateSupplier(
        organization.id,
        params.id,
        body,
      )
      if (!supplier) return status(404, { message: 'Supplier not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Supplier',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return serializeSupplier(supplier)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { supplier: ['update'] },
      params: supplierIdParam,
      body: updateSupplierDto,
      response: {
        200: supplierSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a supplier',
        description: "Updates an existing supplier's details.",
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      const deleted = await suppliersService.deleteSupplier(
        organization.id,
        params.id,
      )
      if (!deleted) return status(404, { message: 'Supplier not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Supplier',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Supplier deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { supplier: ['delete'] },
      params: supplierIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a supplier',
        description: 'Permanently deletes a supplier by its ID.',
      },
    },
  )
