import { prisma } from '#integrations/prisma'

export const warehousesService = {
  async listWarehouses(
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
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            address: { contains: params.search, mode: 'insensitive' as const },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.warehouse.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.warehouse.count({ where }),
    ])
    return { data, total }
  },

  async getWarehouse(organizationId: string, id: string) {
    return prisma.warehouse.findFirst({
      where: { id, organizationId },
    })
  },

  async createWarehouse(
    organizationId: string,
    data: { name: string; address?: string; isActive?: boolean },
  ) {
    return prisma.warehouse.create({
      data: { ...data, organizationId },
    })
  },

  async updateWarehouse(
    organizationId: string,
    id: string,
    data: { name?: string; address?: string; isActive?: boolean },
  ) {
    return prisma.warehouse.updateMany({
      where: { id, organizationId },
      data,
    })
  },

  async deleteWarehouse(organizationId: string, id: string) {
    return prisma.warehouse.deleteMany({
      where: { id, organizationId },
    })
  },
}
