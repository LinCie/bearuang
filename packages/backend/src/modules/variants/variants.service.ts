import { Prisma } from '#generated/prisma/client'
import { prisma } from '#integrations/prisma'

export const variantsService = {
  async listVariantsByProduct(organizationId: string, productId: string) {
    return prisma.productVariant.findMany({
      where: { productId, organizationId, deletedAt: null },
      include: {
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  async listVariants(
    organizationId: string,
    params?: {
      search?: string
      skip?: number
      take?: number
      orderBy?: {
        field: 'name' | 'sku' | 'price' | 'stock' | 'createdAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params?.search
        ? {
            OR: [
              {
                name: { contains: params.search, mode: 'insensitive' as const },
              },
              {
                sku: { contains: params.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where,
        include: {
          product: { select: { name: true } },
          images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
        },
        skip: params?.skip ? Number(params.skip) : undefined,
        take: params?.take ? Number(params.take) : 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.productVariant.count({ where }),
    ])
    return { data, total }
  },

  async listTrashedVariants(
    organizationId: string,
    params?: {
      search?: string
      skip?: number
      take?: number
      orderBy?: {
        field: 'name' | 'sku' | 'price' | 'stock' | 'createdAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: { not: null },
      ...(params?.search
        ? {
            OR: [
              {
                name: { contains: params.search, mode: 'insensitive' as const },
              },
              {
                sku: { contains: params.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where,
        include: {
          product: { select: { name: true } },
          images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
        },
        skip: params?.skip ? Number(params.skip) : undefined,
        take: params?.take ? Number(params.take) : 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.productVariant.count({ where }),
    ])
    return { data, total }
  },

  async restoreVariant(organizationId: string, id: string) {
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    })
  },

  async getVariant(organizationId: string, id: string) {
    return prisma.productVariant.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        product: { select: { name: true } },
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async createVariant(
    organizationId: string,
    productId: string,
    data: {
      sku: string
      name: string
      price: number
      unit?: string
      attributes?: Record<string, unknown>
      isActive?: boolean
    },
  ) {
    const { attributes, ...restData } = data
    return prisma.productVariant.create({
      data: {
        ...restData,
        attributes: attributes
          ? (attributes as Prisma.InputJsonValue)
          : undefined,
        organizationId,
        productId,
      },
      include: {
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async updateVariant(
    organizationId: string,
    id: string,
    data: {
      sku?: string
      name?: string
      price?: number
      unit?: string
      attributes?: Record<string, unknown>
      isActive?: boolean
    },
  ) {
    const { attributes, ...restData } = data
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        ...restData,
        attributes: attributes
          ? (attributes as Prisma.InputJsonValue)
          : undefined,
      },
    })
  },

  async deleteVariant(organizationId: string, id: string) {
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  },

  async addVariantImage(
    organizationId: string,
    variantId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, deletedAt: null },
    })
    if (!variant) throw new Error('Variant not found')

    const maxOrder = await prisma.variantImage.aggregate({
      where: { variantId },
      _max: { sortOrder: true },
    })

    return prisma.variantImage.create({
      data: {
        variantId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { media: true },
    })
  },

  async lookupBySku(organizationId: string, sku: string) {
    return prisma.productVariant.findFirst({
      where: { sku, organizationId, deletedAt: null, isActive: true },
      include: {
        product: { select: { name: true } },
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async removeVariantImage(
    organizationId: string,
    variantId: string,
    imageId: string,
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, deletedAt: null },
    })
    if (!variant) throw new Error('Variant not found')

    return prisma.variantImage.deleteMany({
      where: { id: imageId, variantId },
    })
  },
}
