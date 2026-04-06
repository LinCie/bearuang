import { prisma } from '#integrations/prisma'

const DEFAULT_ORDER = { createdAt: 'desc' } as const

export const suppliersService = {
  async listSuppliers(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      isActive?: boolean
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.isActive !== undefined && { isActive: params.isActive }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search, mode: 'insensitive' as const } },
          {
            address: { contains: params.search, mode: 'insensitive' as const },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : DEFAULT_ORDER,
      }),
      prisma.supplier.count({ where }),
    ])
    return { data, total }
  },

  async getSupplier(organizationId: string, id: string) {
    return prisma.supplier.findFirst({
      where: { id, organizationId },
    })
  },

  async createSupplier(
    organizationId: string,
    data: {
      name: string
      email?: string
      phone?: string
      address?: string
    },
  ) {
    return prisma.supplier.create({
      data: { ...data, organizationId },
    })
  },

  async updateSupplier(
    organizationId: string,
    id: string,
    data: {
      name?: string
      email?: string | null
      phone?: string | null
      address?: string | null
      isActive?: boolean
    },
  ) {
    const existing = await prisma.supplier.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.supplier.update({
      where: { id },
      data,
    })
  },

  async deleteSupplier(organizationId: string, id: string) {
    const existing = await prisma.supplier.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.supplier.delete({ where: { id } })
  },
}
