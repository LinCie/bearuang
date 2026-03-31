import { prisma } from '#integrations/prisma'
import { StockMovementType } from '#generated/prisma/client'

export const stockMovementService = {
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
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ])
    return { data, total }
  },

  async getMovement(organizationId: string, id: string) {
    return prisma.stockMovement.findFirst({
      where: { id, organizationId },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  },

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
          include: {
            variant: {
              select: { id: true, sku: true, name: true },
            },
            warehouse: {
              select: { id: true, name: true },
            },
          },
        }),
        tx.productVariant.updateMany({
          where: { id: data.variantId, organizationId },
          data: { stock: { increment: stockDelta } },
        }),
      ])

      return movement
    })
  },

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
