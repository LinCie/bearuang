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
        include: { variants: { where: { deletedAt: null } } },
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
        include: { variants: true },
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
      include: { variants: { where: { deletedAt: null } } },
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
      include: { variants: true },
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
}
