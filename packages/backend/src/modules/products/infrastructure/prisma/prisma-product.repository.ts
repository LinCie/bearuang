import { prisma } from '#integrations/prisma'
import type {
  AddProductImageParams,
  ListProductsParams,
  ProductRepository,
} from '../../domain/product.repository'

const categorySelect = {
  select: { id: true, name: true, slug: true },
} as const

const productInclude = {
  category: categorySelect,
  variants: {
    where: { deletedAt: null },
    include: {
      images: {
        include: { media: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  },
  images: {
    include: { media: true },
    orderBy: { sortOrder: 'asc' },
  },
} as const

const trashedProductInclude = {
  category: categorySelect,
  variants: {
    include: {
      images: {
        include: { media: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  },
  images: {
    include: { media: true },
    orderBy: { sortOrder: 'asc' },
  },
} as const

const mediaInclude = { media: true } as const

const sortOrderMax = { sortOrder: true } as const

const defaultOrderBy = { createdAt: 'desc' } as const

function buildSearchWhere(search?: string) {
  if (!search) {
    return {}
  }

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      {
        description: {
          contains: search,
          mode: 'insensitive' as const,
        },
      },
    ],
  }
}

function buildActiveProductWhere(params: ListProductsParams) {
  return {
    organizationId: params.organizationId,
    deletedAt: null,
    ...(params.categoryIds && {
      categoryId: { in: [...params.categoryIds] },
    }),
    ...(params.categoryId !== undefined && {
      categoryId: params.categoryId,
    }),
    ...buildSearchWhere(params.search),
  }
}

export function createPrismaProductRepository(): ProductRepository {
  return {
    async list(params) {
      const where = buildActiveProductWhere(params)
      const [data, total] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          include: productInclude,
          skip: params.skip,
          take: params.take ?? 50,
          orderBy: params.orderBy
            ? { [params.orderBy.field]: params.orderBy.order }
            : defaultOrderBy,
        }),
        prisma.product.count({ where }),
      ])

      return { data, total }
    },

    async listTrashed(params) {
      const where = {
        organizationId: params.organizationId,
        deletedAt: { not: null },
        ...buildSearchWhere(params.search),
      }
      const [data, total] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          include: trashedProductInclude,
          skip: params.skip,
          take: params.take ?? 50,
          orderBy: params.orderBy
            ? { [params.orderBy.field]: params.orderBy.order }
            : defaultOrderBy,
        }),
        prisma.product.count({ where }),
      ])

      return { data, total }
    },

    getById(params) {
      return prisma.product.findFirst({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        include: productInclude,
      })
    },

    getBySlug(params) {
      return prisma.product.findFirst({
        where: {
          slug: params.slug,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        include: productInclude,
      })
    },

    create(params) {
      return prisma.product.create({
        data: {
          organizationId: params.organizationId,
          name: params.name,
          slug: params.slug,
          description: params.description,
          isActive: params.isActive,
          categoryId: params.categoryId,
        },
        include: productInclude,
      })
    },

    update(params) {
      return prisma.product.updateMany({
        where: {
          id: params.id,
          organizationId: params.organizationId,
          deletedAt: null,
        },
        data: {
          name: params.name,
          slug: params.slug,
          description: params.description,
          isActive: params.isActive,
          categoryId: params.categoryId,
        },
      })
    },

    async softDelete(params) {
      const now = new Date()

      await prisma.$transaction([
        prisma.productVariant.updateMany({
          where: {
            productId: params.id,
            organizationId: params.organizationId,
            deletedAt: null,
          },
          data: { deletedAt: now },
        }),
        prisma.product.updateMany({
          where: {
            id: params.id,
            organizationId: params.organizationId,
            deletedAt: null,
          },
          data: { deletedAt: now },
        }),
      ])
    },

    async restore(params) {
      await prisma.$transaction([
        prisma.product.updateMany({
          where: {
            id: params.id,
            organizationId: params.organizationId,
            deletedAt: { not: null },
          },
          data: { deletedAt: null },
        }),
        prisma.productVariant.updateMany({
          where: {
            productId: params.id,
            organizationId: params.organizationId,
            deletedAt: { not: null },
          },
          data: { deletedAt: null },
        }),
      ])
    },

    async addImage(params: AddProductImageParams) {
      const maxSort = await prisma.productImage.aggregate({
        where: {
          productId: params.productId,
          product: { organizationId: params.organizationId },
        },
        _max: sortOrderMax,
      })

      return prisma.productImage.create({
        data: {
          productId: params.productId,
          mediaId: params.mediaId,
          altText: params.altText,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
        include: mediaInclude,
      })
    },

    removeImage(params) {
      return prisma.productImage.deleteMany({
        where: {
          id: params.imageId,
          productId: params.productId,
          product: { organizationId: params.organizationId },
        },
      })
    },

    async reorderImages(params) {
      await prisma.$transaction(
        params.imageIds.map((id, index) =>
          prisma.productImage.updateMany({
            where: {
              id,
              productId: params.productId,
              product: { organizationId: params.organizationId },
            },
            data: { sortOrder: index },
          }),
        ),
      )
    },
  }
}
