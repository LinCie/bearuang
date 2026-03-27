import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { customersService } from './customers.service'
import { errorResponse } from '@/common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '@/common/pagination'

export const customerSchema = z.object({
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

export const createCustomerDto = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const updateCustomerDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const listCustomersQuery = paginationQuery
  .extend(sortQuery(['name', 'createdAt', 'updatedAt']).shape)
  .extend({
    search: z.string().optional(),
    isActive: z
      .string()
      .transform((v) => v === 'true')
      .pipe(z.boolean())
      .optional(),
  })

export type Customer = z.infer<typeof customerSchema>
export type CreateCustomerInput = z.infer<typeof createCustomerDto>
export type UpdateCustomerInput = z.infer<typeof updateCustomerDto>
export type ListCustomersQuery = z.infer<typeof listCustomersQuery>

const customerIdParam = z.object({
  id: z.string().uuid(),
})

const serializeCustomer = (c: {
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
  ...c,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
})

export const customersRoute = new Elysia({
  prefix: '/customers',
  tags: ['Customers'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, isActive, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await customersService.listCustomers(
        organization.id,
        {
          skip,
          take,
          search,
          isActive,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeCustomer),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['view'] },
      query: listCustomersQuery,
      response: {
        200: paginatedResponse(customerSchema),
      },
      detail: {
        summary: 'List customers',
        description:
          'Retrieves a paginated list of customers for the authenticated organization. Supports filtering by active status, searching by name/email, and sorting.',
      },
    },
  )
  .post(
    '/',
    async ({ organization, body, status }) => {
      const customer = await customersService.createCustomer(
        organization.id,
        body,
      )
      return status(201, serializeCustomer(customer))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['create'] },
      body: createCustomerDto,
      response: {
        201: customerSchema,
      },
      detail: {
        summary: 'Create a customer',
        description:
          'Creates a new customer for the authenticated organization.',
      },
    },
  )
  .get(
    '/trashed',
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await customersService.listTrashedCustomers(
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
        data: data.map(serializeCustomer),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['view'] },
      query: listCustomersQuery,
      response: {
        200: paginatedResponse(customerSchema),
      },
      detail: {
        summary: 'List trashed customers',
        description:
          'Retrieves a paginated list of soft-deleted customers for the authenticated organization.',
      },
    },
  )
  .post(
    '/:id/restore',
    async ({ organization, params, status }) => {
      const restored = await customersService.restoreCustomer(
        organization.id,
        params.id,
      )
      if (!restored) return status(404, { message: 'Customer not found' })
      return status(200, { message: 'Customer restored' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['delete'] },
      params: customerIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Restore a customer',
        description:
          'Restores a soft-deleted customer by setting isActive to true.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const customer = await customersService.getCustomer(
        organization.id,
        params.id,
      )
      if (!customer) return status(404, { message: 'Customer not found' })
      return serializeCustomer(customer)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['view'] },
      params: customerIdParam,
      response: {
        200: customerSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a customer',
        description: 'Retrieves the details of a specific customer by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ organization, params, body, status }) => {
      const customer = await customersService.updateCustomer(
        organization.id,
        params.id,
        body,
      )
      if (!customer) return status(404, { message: 'Customer not found' })
      return serializeCustomer(customer)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['update'] },
      params: customerIdParam,
      body: updateCustomerDto,
      response: {
        200: customerSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a customer',
        description: "Updates an existing customer's details.",
      },
    },
  )
  .delete(
    '/:id',
    async ({ organization, params, status }) => {
      const deleted = await customersService.deleteCustomer(
        organization.id,
        params.id,
      )
      if (!deleted) return status(404, { message: 'Customer not found' })
      return status(200, { message: 'Customer deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { customer: ['delete'] },
      params: customerIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a customer',
        description: 'Soft-deletes a customer by setting isActive to false.',
      },
    },
  )
