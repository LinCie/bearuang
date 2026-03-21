import { prisma } from "@/integrations/prisma"

export const customersService = {
  async listCustomers(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      isActive?: boolean
      orderBy?: { field: "name" | "createdAt" | "updatedAt"; order: "asc" | "desc" }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.isActive !== undefined && { isActive: params.isActive }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: "insensitive" as const } },
          { email: { contains: params.search, mode: "insensitive" as const } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: "desc" },
      }),
      prisma.customer.count({ where }),
    ])
    return { data, total }
  },

  async getCustomer(organizationId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId },
    })
  },

  async createCustomer(
    organizationId: string,
    data: {
      name: string
      email?: string
      phone?: string
      address?: string
    },
  ) {
    return prisma.customer.create({
      data: { ...data, organizationId },
    })
  },

  async updateCustomer(
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
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data,
    })
  },

  async deleteCustomer(organizationId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data: { isActive: false },
    })
  },
}
