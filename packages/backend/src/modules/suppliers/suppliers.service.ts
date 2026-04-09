import { prisma } from '#integrations/prisma'

const DEFAULT_ORDER = { createdAt: 'desc' } as const

export const suppliersService = {
  /**
   * Lists active suppliers for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search, active filter and sorting parameters.
   * @returns The paginated list of suppliers and total count.
   * @usage Used in suppliers.route.ts, suppliers.ai.ts
   * @sideEffects None (Read-only)
   */
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

  /**
   * Retrieves a single supplier.
   * @param organizationId - Organization identifier.
   * @param id - Supplier identifier.
   * @returns The supplier record or null if not found.
   * @usage Used in suppliers.route.ts, suppliers.ai.ts
   * @sideEffects None (Read-only)
   */
  async getSupplier(organizationId: string, id: string) {
    return prisma.supplier.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * Creates a new supplier.
   * @param organizationId - Organization identifier.
   * @param data - Supplier creation data.
   * @returns The created supplier record.
   * @usage Used in suppliers.route.ts, suppliers.ai.ts
   * @sideEffects Creates a new record in the suppliers table.
   */
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

  /**
   * Updates an existing supplier.
   * @param organizationId - Organization identifier.
   * @param id - Supplier identifier.
   * @param data - Supplier update data.
   * @returns The updated supplier record or null if not found.
   * @usage Used in suppliers.route.ts, suppliers.ai.ts
   * @sideEffects Updates an existing record in the suppliers table.
   */
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

  /**
   * Deletes a supplier.
   * @param organizationId - Organization identifier.
   * @param id - Supplier identifier.
   * @returns The deleted supplier record or null if not found.
   * @usage Used in suppliers.route.ts, suppliers.ai.ts
   * @sideEffects Deletes a record from the suppliers table.
   */
  async deleteSupplier(organizationId: string, id: string) {
    const existing = await prisma.supplier.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.supplier.delete({ where: { id } })
  },
}
