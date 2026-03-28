import { prisma } from '@/integrations/prisma'

export const productsService = {
  async listProducts(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            description: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          variants: {
            where: { deletedAt: null },
            include: {
              images: {
                include: { media: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
        },
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])
    return { data, total }
  },

  async listTrashedProducts(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: { not: null },
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            description: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          variants: {
            include: {
              images: {
                include: { media: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
        },
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])
    return { data, total }
  },

  async getProduct(organizationId: string, id: string) {
    return prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        variants: {
          where: { deletedAt: null },
          include: {
            images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async createProduct(
    organizationId: string,
    data: {
      name: string
      slug: string
      description?: string
      isActive?: boolean
    },
  ) {
    return prisma.product.create({
      data: { ...data, organizationId },
      include: {
        variants: {
          include: {
            images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
        images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
  },

  async updateProduct(
    organizationId: string,
    id: string,
    data: {
      name?: string
      slug?: string
      description?: string
      isActive?: boolean
    },
  ) {
    return prisma.product.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    })
  },

  async deleteProduct(organizationId: string, id: string) {
    const now = new Date()

    await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: { productId: id, organizationId, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.product.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ])
  },

  async restoreProduct(organizationId: string, id: string) {
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { id, organizationId, deletedAt: { not: null } },
        data: { deletedAt: null },
      }),
      prisma.productVariant.updateMany({
        where: { productId: id, organizationId, deletedAt: { not: null } },
        data: { deletedAt: null },
      }),
    ])
  },

  async addProductImage(
    organizationId: string,
    productId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const maxSort = await prisma.productImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    })
    return prisma.productImage.create({
      data: {
        productId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { media: true },
    })
  },

  async removeProductImage(
    organizationId: string,
    productId: string,
    imageId: string,
  ) {
    return prisma.productImage.deleteMany({
      where: { id: imageId, productId },
    })
  },

  async reorderProductImages(
    organizationId: string,
    productId: string,
    imageIds: string[],
  ) {
    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.productImage.updateMany({
          where: { id, productId },
          data: { sortOrder: index },
        }),
      ),
    )
  },

  async addVariantImage(
    organizationId: string,
    variantId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const maxSort = await prisma.variantImage.aggregate({
      where: { variantId },
      _max: { sortOrder: true },
    })
    return prisma.variantImage.create({
      data: {
        variantId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { media: true },
    })
  },

  async removeVariantImage(
    organizationId: string,
    variantId: string,
    imageId: string,
  ) {
    return prisma.variantImage.deleteMany({
      where: { id: imageId, variantId },
    })
  },

  async reorderVariantImages(
    organizationId: string,
    variantId: string,
    imageIds: string[],
  ) {
    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.variantImage.updateMany({
          where: { id, variantId },
          data: { sortOrder: index },
        }),
      ),
    )
  },
}
