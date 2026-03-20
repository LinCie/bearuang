import { prisma } from "@/integrations/prisma"

export const warehousesService = {
  async listWarehouses(
    organizationId: string,
    params?: { skip?: number; take?: number },
  ) {
    return prisma.warehouse.findMany({
      where: { organizationId },
      skip: params?.skip,
      take: params?.take ?? 50,
      orderBy: { createdAt: "desc" },
    })
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
