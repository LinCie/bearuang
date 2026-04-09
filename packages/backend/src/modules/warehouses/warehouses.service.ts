import { prisma } from '#integrations/prisma'

const DEFAULT_ORDER = { createdAt: 'desc' } as const

export const warehousesService = {
  /**
   * Lists warehouses for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of warehouses and total count.
   * @usage Used in warehouses.route.ts, warehouses.ai.ts
   * @sideEffects None (Read-only)
   */
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
          : DEFAULT_ORDER,
      }),
      prisma.warehouse.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single warehouse.
   * @param organizationId - Organization identifier.
   * @param id - Warehouse identifier.
   * @returns The warehouse record or null if not found.
   * @usage Used in warehouses.route.ts, warehouses.ai.ts
   * @sideEffects None (Read-only)
   */
  async getWarehouse(organizationId: string, id: string) {
    return prisma.warehouse.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * Creates a new warehouse.
   * @param organizationId - Organization identifier.
   * @param data - Warehouse creation data.
   * @returns The created warehouse record.
   * @usage Used in warehouses.route.ts, warehouses.ai.ts
   * @sideEffects Creates a new record in the warehouses table.
   */
  async createWarehouse(
    organizationId: string,
    data: { name: string; address?: string; isActive?: boolean },
  ) {
    return prisma.warehouse.create({
      data: { ...data, organizationId },
    })
  },

  /**
   * Updates an existing warehouse.
   * @param organizationId - Organization identifier.
   * @param id - Warehouse identifier.
   * @param data - Warehouse update data.
   * @returns The number of updated records.
   * @usage Used in warehouses.route.ts, warehouses.ai.ts
   * @sideEffects Updates an existing record in the warehouses table.
   */
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

  /**
   * Deletes a warehouse.
   * @param organizationId - Organization identifier.
   * @param id - Warehouse identifier.
   * @returns The number of deleted records.
   * @usage Used in warehouses.route.ts, warehouses.ai.ts
   * @sideEffects Deletes a record from the warehouses table.
   */
  async deleteWarehouse(organizationId: string, id: string) {
    return prisma.warehouse.deleteMany({
      where: { id, organizationId },
    })
  },
}
