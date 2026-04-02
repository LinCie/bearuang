import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { salesOrdersService } from './sales-orders.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

const salesOrderItemSchema = z.object({
  id: z.string(),
  salesOrderId: z.string(),
  variantId: z.string(),
  variant: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
  }),
  quantity: z.number().int(),
  unitPrice: z.string(),
})

const salesOrderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  customerId: z.string().nullable(),
  customer: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  warehouseId: z.string(),
  warehouse: z.object({
    id: z.string(),
    name: z.string(),
  }),
  guestName: z.string().nullable(),
  guestEmail: z.string().nullable(),
  shippingAddress: z.any(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ]),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']),
  paymentMethod: z.string().nullable(),
  amountPaid: z.string(),
  orderedAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(salesOrderItemSchema),
})

const createSalesOrderItemDto = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
})

const createSalesOrderDto = z.object({
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  shippingAddress: z.record(z.string(), z.any()).optional(),
  orderedAt: z.iso.datetime().optional(),
  note: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER', 'CARD']).optional(),
  items: z.array(createSalesOrderItemDto).min(1),
})

const updateSalesOrderDto = z.object({
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ])
    .optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
  paymentMethod: z
    .enum(['CASH', 'QRIS', 'TRANSFER', 'CARD'])
    .nullable()
    .optional(),
  amountPaid: z.number().nonnegative().optional(),
  customerId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().optional(),
  guestName: z.string().nullable().optional(),
  guestEmail: z.string().email().nullable().optional(),
  shippingAddress: z.record(z.string(), z.any()).optional(),
  orderedAt: z.iso.datetime().nullable().optional(),
  shippedAt: z.iso.datetime().nullable().optional(),
  note: z.string().nullable().optional(),
})

const listSalesOrdersQuery = paginationQuery
  .extend(sortQuery(['createdAt', 'updatedAt', 'orderedAt']).shape)
  .extend({
    status: z
      .enum([
        'PENDING',
        'CONFIRMED',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
      ])
      .optional(),
    paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
    customerId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    search: z.string().optional(),
  })

const salesOrderIdParam = z.object({
  id: z.string().uuid(),
})

const serializeSalesOrder = (so: {
  id: string
  organizationId: string
  customerId: string | null
  customer: { id: string; name: string } | null
  warehouseId: string
  warehouse: { id: string; name: string }
  guestName: string | null
  guestEmail: string | null
  shippingAddress: unknown
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paymentMethod: string | null
  amountPaid: { toString: () => string }
  orderedAt: Date | null
  shippedAt: Date | null
  note: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    salesOrderId: string
    variantId: string
    variant: { id: string; sku: string; name: string }
    quantity: number
    unitPrice: { toString: () => string }
  }>
}) => {
  return {
    ...so,
    amountPaid: so.amountPaid.toString(),
    orderedAt: so.orderedAt?.toISOString() ?? null,
    shippedAt: so.shippedAt?.toISOString() ?? null,
    createdAt: so.createdAt.toISOString(),
    updatedAt: so.updatedAt.toISOString(),
    items: so.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
    })),
  }
}

// ─── Type Exports ────────────────────────────────────────────

export type SalesOrder = z.infer<typeof salesOrderSchema>
export type SalesOrderItem = z.infer<typeof salesOrderItemSchema>
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderDto>
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderDto>
export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersQuery>

export const salesOrdersRoute = new Elysia({
  prefix: '/sales-orders',
  tags: ['Sales Orders'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const {
        page,
        pageSize,
        sortBy,
        sortOrder,
        status,
        paymentStatus,
        customerId,
        search,
      } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await salesOrdersService.listSalesOrders(
        organization.id,
        {
          skip,
          take,
          status,
          paymentStatus,
          customerId,
          search,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: data.map(serializeSalesOrder),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { salesOrder: ['view'] },
      query: listSalesOrdersQuery,
      response: {
        200: paginatedResponse(salesOrderSchema),
      },
      detail: {
        summary: 'List sales orders',
        description:
          'Retrieves a paginated list of sales orders for the authenticated organization. Supports filtering by status, payment status, customer, and search by note, guest email, or guest name.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      const result = await salesOrdersService.createSalesOrder(
        organization.id,
        {
          ...body,
          orderedAt: body.orderedAt ? new Date(body.orderedAt) : undefined,
        },
      )
      if ('error' in result) return status(400, { message: result.error })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'SalesOrder',
        operation: 'create',
        args: { data: body },
      })
      return status(
        201,
        serializeSalesOrder(
          result as Parameters<typeof serializeSalesOrder>[0],
        ),
      )
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { salesOrder: ['create'] },
      body: createSalesOrderDto,
      response: {
        201: salesOrderSchema,
        400: errorResponse,
      },
      detail: {
        summary: 'Create a sales order',
        description:
          'Creates a new sales order with line items for the authenticated organization. Either customerId or guestName must be provided.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const order = await salesOrdersService.getSalesOrder(
        organization.id,
        params.id,
      )
      if (!order) return status(404, { message: 'Sales order not found' })
      return serializeSalesOrder(order)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { salesOrder: ['view'] },
      params: salesOrderIdParam,
      response: {
        200: salesOrderSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a sales order',
        description:
          'Retrieves the details of a specific sales order by its ID, including all line items with variant details.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ _authType, organization, user, params, body, status }) => {
      const result = await salesOrdersService.updateSalesOrder(
        organization.id,
        params.id,
        {
          ...body,
          orderedAt:
            body.orderedAt !== undefined
              ? body.orderedAt
                ? new Date(body.orderedAt)
                : null
              : undefined,
          shippedAt:
            body.shippedAt !== undefined
              ? body.shippedAt
                ? new Date(body.shippedAt)
                : null
              : undefined,
        },
      )
      if ('error' in result) {
        if (result.error === 'not_found')
          return status(404, { message: 'Sales order not found' })
        return status(400, { message: result.error })
      }
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'SalesOrder',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return serializeSalesOrder(
        result as Parameters<typeof serializeSalesOrder>[0],
      )
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { salesOrder: ['update'] },
      params: salesOrderIdParam,
      body: updateSalesOrderDto,
      response: {
        200: salesOrderSchema,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a sales order',
        description:
          'Updates header fields of an existing sales order. Items cannot be modified after creation.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      const result = await salesOrdersService.deleteSalesOrder(
        organization.id,
        params.id,
      )
      if ('error' in result) {
        if (result.error === 'not_found')
          return status(404, { message: 'Sales order not found' })
        return status(400, { message: result.error })
      }
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'SalesOrder',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Sales order deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { salesOrder: ['delete'] },
      params: salesOrderIdParam,
      response: {
        200: errorResponse,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a sales order',
        description:
          'Permanently deletes a sales order. Only allowed when status is PENDING or CANCELLED.',
      },
    },
  )
