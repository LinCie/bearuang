import { prisma } from '#integrations/prisma'

const activeFilter = { isActive: true } as const
const inactiveFilter = { isActive: false } as const
const defaultOrderBy = { createdAt: 'desc' } as const

export const customersService = {
  /**
   * Lists active customers for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and filter parameters.
   * @returns The paginated list of customers and total count.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects None (Read-only)
   */
  async listCustomers(
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
      isActive: params?.isActive ?? true,
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
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
          : defaultOrderBy,
      }),
      prisma.customer.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Lists inactive (soft-deleted) customers for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of trashed customers and total count.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects None (Read-only)
   */
  async listTrashedCustomers(
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
      ...inactiveFilter,
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
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
          : defaultOrderBy,
      }),
      prisma.customer.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Restores an inactive (soft-deleted) customer.
   * @param organizationId - Organization identifier.
   * @param id - Customer identifier.
   * @returns The restored customer record or null if not found.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects Updates isActive to true in customers table.
   */
  async restoreCustomer(organizationId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId, ...inactiveFilter },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data: activeFilter,
    })
  },

  /**
   * Retrieves a single customer.
   * @param organizationId - Organization identifier.
   * @param id - Customer identifier.
   * @returns The customer record or null if not found.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects None (Read-only)
   */
  async getCustomer(organizationId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * Creates a new customer.
   * @param organizationId - Organization identifier.
   * @param data - Customer creation data.
   * @returns The created customer record.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects Creates a new record in the customers table.
   */
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

  /**
   * Updates an existing customer.
   * @param organizationId - Organization identifier.
   * @param id - Customer identifier.
   * @param data - Customer update data.
   * @returns The updated customer record or null if not found.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects Updates an existing record in the customers table.
   */
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

  /**
   * Soft deletes a customer by setting isActive to false.
   * @param organizationId - Organization identifier.
   * @param id - Customer identifier.
   * @returns The deactivated customer record or null if not found.
   * @usage Used in customers.route.ts, customers.ai.ts
   * @sideEffects Updates isActive to false in customers table.
   */
  async deleteCustomer(organizationId: string, id: string) {
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null
    return prisma.customer.update({
      where: { id },
      data: inactiveFilter,
    })
  },
}
