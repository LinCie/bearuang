import { prisma } from '@/integrations/prisma'
import {
  PurchaseOrderStatus,
  PurchaseOrderPaymentStatus,
} from '@/generated/prisma/client'

const STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CANCELLED'],
  RECEIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

const TERMINAL_STATUSES: PurchaseOrderStatus[] = ['COMPLETED', 'CANCELLED']

export const purchaseOrdersService = {
  async listPurchaseOrders(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      status?: PurchaseOrderStatus
      paymentStatus?: PurchaseOrderPaymentStatus
      supplierId?: string
      warehouseId?: string
      orderBy?: {
        field: 'createdAt' | 'updatedAt' | 'orderedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.status && { status: params.status }),
      ...(params?.paymentStatus && { paymentStatus: params.paymentStatus }),
      ...(params?.supplierId && { supplierId: params.supplierId }),
      ...(params?.warehouseId && { warehouseId: params.warehouseId }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
          items: {
            include: {
              variant: { select: { id: true, sku: true, name: true } },
            },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])
    return { data, total }
  },

  async getPurchaseOrder(organizationId: string, id: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async createPurchaseOrder(
    organizationId: string,
    data: {
      supplierId: string
      warehouseId: string
      orderedAt?: Date
      note?: string
      items: Array<{
        variantId: string
        quantity: number
        unitCost: number
      }>
    },
  ) {
    return prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        orderedAt: data.orderedAt,
        note: data.note,
        items: {
          create: data.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async updatePurchaseOrder(
    organizationId: string,
    id: string,
    data: {
      status?: PurchaseOrderStatus
      paymentStatus?: PurchaseOrderPaymentStatus
      supplierId?: string
      warehouseId?: string
      orderedAt?: Date | null
      note?: string | null
    },
  ) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { items: true },
    })
    if (!existing) return { error: 'not_found' as const }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      return {
        error: `Cannot modify a ${existing.status.toLowerCase()} purchase order`,
      }
    }

    if (data.status) {
      const allowed = STATUS_TRANSITIONS[existing.status]
      if (!allowed.includes(data.status)) {
        return {
          error: `Cannot transition from ${existing.status} to ${data.status}`,
        }
      }

      if (data.status === 'COMPLETED') {
        const allReceived = existing.items.every(
          (item) => item.receivedQty >= item.quantity,
        )
        if (!allReceived) {
          return {
            error:
              'Cannot complete order: not all items have been fully received',
          }
        }
      }
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async receivePurchaseOrder(
    organizationId: string,
    id: string,
    receivedItems: Array<{ itemId: string; receivedQty: number }>,
  ) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { items: true },
    })
    if (!order) return { error: 'not_found' as const }

    if (!['CONFIRMED', 'SHIPPED'].includes(order.status)) {
      return {
        error: `Cannot receive items on a ${order.status.toLowerCase()} purchase order`,
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const received of receivedItems) {
        const item = order.items.find((i) => i.id === received.itemId)
        if (!item) continue

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: item.receivedQty + received.receivedQty },
        })

        if (received.receivedQty > 0) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: order.warehouseId,
              variantId: item.variantId,
              type: 'IN',
              quantity: received.receivedQty,
              referenceId: order.id,
              referenceType: 'purchase_order',
            },
          })

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: received.receivedQty } },
          })
        }
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
      })
    })

    return prisma.purchaseOrder.findFirst({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async deletePurchaseOrder(organizationId: string, id: string) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return { error: 'not_found' as const }

    if (existing.status !== 'PENDING') {
      return {
        error: `Cannot delete a ${existing.status.toLowerCase()} purchase order`,
      }
    }

    return prisma.purchaseOrder.delete({ where: { id } })
  },
}
