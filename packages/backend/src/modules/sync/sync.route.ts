import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { prisma } from '#integrations/prisma'
import { logger } from '#libraries/utilities'

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
