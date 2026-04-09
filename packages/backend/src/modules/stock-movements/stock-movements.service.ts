import { prisma } from '#integrations/prisma'
import { StockMovementType } from '#generated/prisma/client'

const movementInclude = {
  variant: { select: { id: true, sku: true, name: true } },
  warehouse: { select: { id: true, name: true } },
} as const

const movementDefaultOrderBy = { createdAt: 'desc' as const }

export const stockMovementService = {
  /**
   * Lists stock movements for an organization with optional filters.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search, and filter parameters.
   * @returns The paginated list of stock movements and total count.
   * @usage Used in stock-movements.route.ts
   * @sideEffects None (Read-only)
   */
  async listMovements(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      variantId?: string
      warehouseId?: string
      type?: StockMovementType
      referenceId?: string
      referenceType?: string
      orderBy?: {
        field: 'createdAt' | 'quantity' | 'type'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.variantId && { variantId: params.variantId }),
      ...(params?.warehouseId && { warehouseId: params.warehouseId }),
      ...(params?.type && { type: params.type }),
      ...(params?.referenceId && { referenceId: params.referenceId }),
      ...(params?.referenceType && { referenceType: params.referenceType }),
      ...(params?.search && {
        OR: [
          { note: { contains: params.search, mode: 'insensitive' as const } },
          {
            variant: {
              name: { contains: params.search, mode: 'insensitive' as const },
            },
          },
          {
            variant: {
              sku: { contains: params.search, mode: 'insensitive' as const },
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : movementDefaultOrderBy,
      }),
      prisma.stockMovement.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single stock movement.
   * @param organizationId - Organization identifier.
   * @param id - Stock movement identifier.
   * @returns The stock movement record or null if not found.
   * @usage Used in stock-movements.route.ts
   * @sideEffects None (Read-only)
   */
  async getMovement(organizationId: string, id: string) {
    return prisma.stockMovement.findFirst({
      where: { id, organizationId },
      include: movementInclude,
    })
  },

  /**
   * Creates a new stock movement and atomically updates the variant's stock cache.
   * @param organizationId - Organization identifier.
   * @param data - Stock movement creation data.
   * @returns The created stock movement record.
   * @usage Used in stock-movements.route.ts
   * @sideEffects Creates a new record in the stockMovement table and updates stock in productVariant table.
   */
  async createMovement(
    organizationId: string,
    data: {
      warehouseId: string
      variantId: string
      type: StockMovementType
      quantity: number
      referenceId?: string
      referenceType?: string
      note?: string
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const stockDelta =
        data.type === StockMovementType.IN
          ? data.quantity
          : data.type === StockMovementType.OUT
            ? -data.quantity
            : data.quantity

      const [movement] = await Promise.all([
        tx.stockMovement.create({
          data: { ...data, organizationId },
          include: movementInclude,
        }),
        tx.productVariant.updateMany({
          where: { id: data.variantId, organizationId },
          data: { stock: { increment: stockDelta } },
        }),
      ])

      return movement
    })
  },

  /**
   * Deletes a stock movement and reverses its effect on the variant stock cache.
   * @param organizationId - Organization identifier.
   * @param id - Stock movement identifier.
   * @returns The deleted stock movement record or null if not found.
   * @usage Used in stock-movements.route.ts
   * @sideEffects Deletes a record from the stockMovement table and reverses stock update in productVariant table.
   */
  async deleteMovement(organizationId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findFirst({
        where: { id, organizationId },
      })

      if (!movement) return null

      const stockDelta =
        movement.type === StockMovementType.IN
          ? -movement.quantity
          : movement.type === StockMovementType.OUT
            ? movement.quantity
            : -movement.quantity

      await Promise.all([
        tx.stockMovement.delete({ where: { id } }),
        tx.productVariant.updateMany({
          where: { id: movement.variantId, organizationId },
          data: { stock: { increment: stockDelta } },
        }),
      ])

      return movement
    })
  },
}
