import { Prisma } from '#generated/prisma/client'
import { prisma } from '#integrations/prisma'
import type {
  AddVariantImageParams,
  CreateVariantParams,
  DeleteVariantParams,
  GetVariantBySkuParams,
  GetVariantParams,
  ListVariantsParams,
  MutateCountResult,
  RemoveVariantImageParams,
  UpdateVariantParams,
  VariantRepository,
} from '../../domain/variant.repository'

const variantImagesInclude = {
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} as const

const variantWithProductInclude = {
  product: { select: { name: true } },
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} as const

const mediaInclude = { media: true } as const

const variantSortOrderMax = { sortOrder: true } as const

const variantDefaultOrderBy = { createdAt: 'desc' as const } as const

function buildSearchWhere(search?: string) {
  if (!search) {
    return {}
  }

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { sku: { contains: search, mode: 'insensitive' as const } },
    ],
  }
}

function buildActiveVariantWhere(params: ListVariantsParams) {
  return {
    organizationId: params.organizationId,
    deletedAt: null,
    ...buildSearchWhere(params.search),
  }
}

export function createPrismaVariantRepository(): VariantRepository {
  return {
    async list(params: ListVariantsParams) {
      const where = buildActiveVariantWhere(params)
      const [data, total] = await prisma.$transaction([
        prisma.productVariant.findMany({
          where,
          include: variantWithProductInclude,
          skip: params.skip,
          take: params.take ?? 50,
          orderBy: params.orderBy
            ? { [params.orderBy.field]: params.orderBy.order }
            : variantDefaultOrderBy,
        }),
        prisma.productVariant.count({ where }),
      ])

      return { data, total }
    },

    async listTrashed(params: ListVariantsParams) {
      const where = {
        organizationId: params.organizationId,
        deletedAt: { not: null },
        ...buildSearchWhere(params.search),
      }
      const [data, total] = await prisma.$transaction([
        prisma.productVariant.findMany({
          where,
          include: variantWithProductInclude,
          skip: params.skip,
          take: params.take ?? 50,
          orderBy: params.orderBy
            ? { [params.orderBy.field]: params.orderBy.order }
            : variantDefaultOrderBy,
        }),
        prisma.productVariant.count({ where }),
      ])

      return { data, total }
    },

    listByProduct(params: { organizationId: string; productId: string }) {
      return prisma.productVariant.findMany({
        where: {
          productId: params.productId,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        include: variantImagesInclude,
        orderBy: { createdAt: 'asc' as const },
      })
    },

    getById(params: GetVariantParams) {
      return prisma.productVariant.findFirst({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        include: variantWithProductInclude,
      })
    },

    getBySku(params: GetVariantBySkuParams) {
      return prisma.productVariant.findFirst({
        where: {
          sku: params.sku,
          organizationId: params.organizationId,
          deletedAt: null,
          isActive: true,
        },
        include: variantWithProductInclude,
      })
    },

    create(params: CreateVariantParams) {
      const { attributes, ...restData } = params
      return prisma.productVariant.create({
        data: {
          ...restData,
          attributes: attributes
            ? (attributes as Prisma.InputJsonValue)
            : undefined,
        },
        include: variantImagesInclude,
      })
    },

    update(params: UpdateVariantParams): Promise<MutateCountResult> {
      const { attributes, ...restData } = params
      return prisma.productVariant.updateMany({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        data: {
          ...restData,
          attributes: attributes
            ? (attributes as Prisma.InputJsonValue)
            : undefined,
        },
      })
    },

    async softDelete(params: DeleteVariantParams): Promise<void> {
      const now = new Date()

      await prisma.productVariant.updateMany({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      })
    },

    async restore(params: DeleteVariantParams): Promise<void> {
      await prisma.productVariant.updateMany({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: { not: null },
        },
        data: { deletedAt: null },
      })
    },

    async addImage(params: AddVariantImageParams) {
      const maxOrder = await prisma.variantImage.aggregate({
        where: { variantId: params.variantId },
        _max: variantSortOrderMax,
      })

      return prisma.variantImage.create({
        data: {
          variantId: params.variantId,
          mediaId: params.mediaId,
          altText: params.altText,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        include: mediaInclude,
      })
    },

    removeImage(params: RemoveVariantImageParams): Promise<MutateCountResult> {
      return prisma.variantImage.deleteMany({
        where: {
          id: params.imageId,
          variantId: params.variantId,
        },
      })
    },
  }
}
