import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { prisma } from '#integrations/prisma'
import { logger } from '#libraries/utilities'
import { salesOrdersService } from '#modules/sales-orders/sales-orders.service'
import { logAudit } from '#libraries/audit-logger'

const SYNC_MODELS = [
  'products',
  'variants',
  'categories',
  'customers',
  'warehouses',
  'suppliers',
] as const

type SyncModel = (typeof SYNC_MODELS)[number]

const MAX_RECORDS_PER_MODEL = 10_000

function serializeDate(d: Date | null): string | null {
  return d?.toISOString() ?? null
}

function serializeDecimal(d: { toNumber: () => number }): number {
  return d.toNumber()
}

interface DateFields {
  createdAt: Date
  updatedAt: Date
}

function withSerializedDates<T extends DateFields>(
  r: T,
): Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
} {
  return {
    ...r,
    createdAt: serializeDate(r.createdAt),
    updatedAt: serializeDate(r.updatedAt),
  }
}

interface SoftDeleteFields {
  deletedAt: Date | null
}

function withSerializedSoftDelete<T extends DateFields & SoftDeleteFields>(
  r: T,
): Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  createdAt: string
  updatedAt: string
  deletedAt: string | null
} {
  return {
    ...r,
    createdAt: serializeDate(r.createdAt),
    updatedAt: serializeDate(r.updatedAt),
    deletedAt: serializeDate(r.deletedAt),
  }
}

async function fetchModelData(
  organizationId: string,
  model: SyncModel,
): Promise<unknown[]> {
  switch (model) {
    case 'products':
      return prisma.product
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            name: true,
            slug: true,
            description: true,
            categoryId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedSoftDelete))

    case 'variants':
      return prisma.productVariant
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            productId: true,
            sku: true,
            name: true,
            price: true,
            stock: true,
            unit: true,
            attributes: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) =>
          records.map((r) => ({
            ...withSerializedSoftDelete(r),
            price: serializeDecimal(
              r.price as unknown as { toNumber: () => number },
            ),
          })),
        )

    case 'categories':
      return prisma.productCategory
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            parentId: true,
            name: true,
            slug: true,
            description: true,
            sortOrder: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedSoftDelete))

    case 'customers':
      return prisma.customer
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))

    case 'warehouses':
      return prisma.warehouse
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            name: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))

    case 'suppliers':
      return prisma.supplier
        .findMany({
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))
  }
}

async function fetchModelDelta(
  organizationId: string,
  model: SyncModel,
  since: Date,
): Promise<unknown[]> {
  switch (model) {
    case 'products':
      return prisma.product
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            name: true,
            slug: true,
            description: true,
            categoryId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedSoftDelete))

    case 'variants':
      return prisma.productVariant
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            productId: true,
            sku: true,
            name: true,
            price: true,
            stock: true,
            unit: true,
            attributes: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) =>
          records.map((r) => ({
            ...withSerializedSoftDelete(r),
            price: serializeDecimal(
              r.price as unknown as { toNumber: () => number },
            ),
          })),
        )

    case 'categories':
      return prisma.productCategory
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            parentId: true,
            name: true,
            slug: true,
            description: true,
            sortOrder: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedSoftDelete))

    case 'customers':
      return prisma.customer
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))

    case 'warehouses':
      return prisma.warehouse
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            name: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))

    case 'suppliers':
      return prisma.supplier
        .findMany({
          where: { organizationId, updatedAt: { gt: since } },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          take: MAX_RECORDS_PER_MODEL,
        })
        .then((records) => records.map(withSerializedDates))
  }
}

function parseModels(models: string | string[] | undefined): SyncModel[] {
  if (!models) return []
  const str = Array.isArray(models) ? models.join(',') : models
  return str
    .split(',')
    .map((m) => m.trim())
    .filter((m): m is SyncModel => SYNC_MODELS.includes(m as SyncModel))
}

interface BatchMutation {
  tempId: string
  model: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
}

interface BatchResult {
  tempId: string
  serverId?: string
  status: 'success' | 'conflict' | 'failed'
  conflictData?: unknown
  error?: string
}

async function processBatchMutation(
  organizationId: string,
  userId: string,
  authType: 'session' | 'api_key',
  mutation: BatchMutation,
): Promise<BatchResult> {
  const { tempId, model, operation, data } = mutation

  switch (model) {
    case 'sales-orders': {
      if (operation === 'create') {
        const items = (data.items as Array<Record<string, unknown>>) ?? []
        const result = await salesOrdersService.createSalesOrder(
          organizationId,
          {
            warehouseId: data.warehouseId as string,
            customerId: data.customerId as string | undefined,
            guestName: data.guestName as string | undefined,
            guestEmail: data.guestEmail as string | undefined,
            paymentMethod: data.paymentMethod as
              | 'CASH'
              | 'QRIS'
              | 'TRANSFER'
              | 'CARD'
              | undefined,
            note: data.note as string | undefined,
            orderedAt: data.orderedAt
              ? new Date(data.orderedAt as string)
              : undefined,
            items: items.map((item) => ({
              variantId: item.variantId as string,
              quantity: item.quantity as number,
              unitPrice: item.unitPrice as number,
            })),
          },
        )

        if ('error' in result) {
          return { tempId, status: 'failed', error: result.error }
        }

        void logAudit({
          organizationId,
          userId,
          authType,
          model: 'SalesOrder',
          operation: 'create',
          args: { data, offlineSync: true, tempId },
        })

        return { tempId, serverId: result.id, status: 'success' }
      }

      if (operation === 'update') {
        const id = data.id as string
        if (!id) {
          return { tempId, status: 'failed', error: 'Missing id for update' }
        }

        const result = await salesOrdersService.updateSalesOrder(
          organizationId,
          id,
          {
            status: data.status as
              | 'PENDING'
              | 'CONFIRMED'
              | 'SHIPPED'
              | 'DELIVERED'
              | 'COMPLETED'
              | 'CANCELLED'
              | undefined,
            paymentStatus: data.paymentStatus as
              | 'UNPAID'
              | 'PARTIALLY_PAID'
              | 'PAID'
              | undefined,
            paymentMethod: data.paymentMethod as string | null | undefined,
            note: data.note as string | null | undefined,
          },
        )

        if ('error' in result) {
          if (result.error === 'not_found') {
            return { tempId, status: 'failed', error: 'Sales order not found' }
          }
          return {
            tempId,
            status: 'conflict',
            error: result.error,
            conflictData: { currentState: result },
          }
        }

        void logAudit({
          organizationId,
          userId,
          authType,
          model: 'SalesOrder',
          operation: 'update',
          args: { id, data, offlineSync: true, tempId },
        })

        return { tempId, serverId: id, status: 'success' }
      }

      return {
        tempId,
        status: 'failed',
        error: `Unsupported operation: ${operation} for ${model}`,
      }
    }

    case 'customers': {
      if (operation === 'create') {
        const customer = await prisma.customer.create({
          data: {
            organizationId,
            name: data.name as string,
            email: (data.email as string) ?? null,
            phone: (data.phone as string) ?? null,
            address: (data.address as string) ?? null,
          },
        })

        void logAudit({
          organizationId,
          userId,
          authType,
          model: 'Customer',
          operation: 'create',
          args: { data, offlineSync: true, tempId },
        })

        return { tempId, serverId: customer.id, status: 'success' }
      }
      return {
        tempId,
        status: 'failed',
        error: `Unsupported operation: ${operation} for ${model}`,
      }
    }

    default:
      return {
        tempId,
        status: 'failed',
        error: `Unknown model: ${model}`,
      }
  }
}

export const syncRoute = new Elysia({
  prefix: '/sync',
  tags: ['Sync'],
})
  .use(authPlugin)
  .get(
    '/initial',
    async ({ organization }) => {
      const allModels =
        'products,variants,categories,customers,warehouses,suppliers'
      const models = parseModels(allModels)

      const results = await Promise.all(
        models.map(async (model) => {
          try {
            const data = await fetchModelData(organization.id, model)
            return [model, data]
          } catch (err) {
            logger.error({ err, model }, 'Failed to fetch model data')
            return [model, []]
          }
        }),
      )

      const modelResults = Object.fromEntries(results)
      const syncTimestamp = new Date().toISOString()

      return { models: modelResults, syncTimestamp }
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: z.object({
        models: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .default(
            'products,variants,categories,customers,warehouses,suppliers',
          ),
      }),
      detail: {
        summary: 'Initial sync',
        description:
          'Fetches all records for the requested models for the current organization. Used for initial data load.',
      },
    },
  )
  .get(
    '/delta',
    async ({ organization, query }) => {
      const models = parseModels(query.models)
      const since = new Date(query.since)

      if (isNaN(since.getTime())) {
        return { error: 'Invalid since timestamp' }
      }

      const results = await Promise.all(
        models.map(async (model) => {
          try {
            const data = await fetchModelDelta(organization.id, model, since)
            return [model, data]
          } catch (err) {
            logger.error(
              { err, model, since: query.since },
              'Failed to fetch delta',
            )
            return [model, []]
          }
        }),
      )

      const modelResults = Object.fromEntries(results)
      const syncTimestamp = new Date().toISOString()

      return { models: modelResults, syncTimestamp }
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: z.object({
        since: z.string(),
        models: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .default(
            'products,variants,categories,customers,warehouses,suppliers',
          ),
      }),
      detail: {
        summary: 'Delta sync',
        description:
          'Fetches records updated since the given timestamp for the requested models. Includes soft-deleted records.',
      },
    },
  )
  .post(
    '/batch',
    async ({ _authType, organization, user, body }) => {
      const results: Array<{
        tempId: string
        serverId?: string
        status: 'success' | 'conflict' | 'failed'
        conflictData?: unknown
        error?: string
      }> = []

      for (const mutation of body.mutations) {
        try {
          const result = await processBatchMutation(
            organization.id,
            user.id,
            _authType,
            mutation,
          )
          results.push(result)
        } catch (err) {
          logger.error(
            { err, tempId: mutation.tempId, model: mutation.model },
            'Batch mutation failed',
          )
          results.push({
            tempId: mutation.tempId,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      return { results }
    },
    {
      requireAuth: true,
      requireOrg: true,
      body: z.object({
        mutations: z
          .array(
            z.object({
              tempId: z.string(),
              model: z.string(),
              operation: z.enum(['create', 'update', 'delete']),
              data: z.record(z.string(), z.unknown()),
            }),
          )
          .min(1)
          .max(50),
      }),
      response: {
        200: z.object({
          results: z.array(
            z.object({
              tempId: z.string(),
              serverId: z.string().optional(),
              status: z.enum(['success', 'conflict', 'failed']),
              conflictData: z.unknown().optional(),
              error: z.string().optional(),
            }),
          ),
        }),
      },
      detail: {
        summary: 'Batch sync mutations',
        description:
          'Processes a batch of offline mutations. Each mutation is processed in order. Returns per-mutation results with success/conflict/failed status.',
      },
    },
  )
