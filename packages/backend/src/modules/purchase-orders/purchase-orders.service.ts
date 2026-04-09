import { prisma } from '#integrations/prisma'
import {
  PurchaseOrderStatus,
  PurchaseOrderPaymentStatus,
} from '#generated/prisma/client'

const STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CANCELLED'],
  RECEIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

const TERMINAL_STATUSES: PurchaseOrderStatus[] = ['COMPLETED', 'CANCELLED']

const purchaseOrderInclude = {
  supplier: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  items: {
    include: {
      variant: { select: { id: true, sku: true, name: true } },
    },
  },
} as const

const purchaseOrderItemsInclude = { items: true } as const

const purchaseOrderDefaultOrderBy = { createdAt: 'desc' } as const

export const purchaseOrdersService = {
  /**
   * Lists purchase orders for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, filtering and sorting parameters.
   * @returns The paginated list of purchase orders and total count.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects None (Read-only)
   */
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
          : purchaseOrderDefaultOrderBy,
        include: purchaseOrderInclude,
      }),
      prisma.purchaseOrder.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single purchase order.
   * @param organizationId - Organization identifier.
   * @param id - Purchase order identifier.
   * @returns The purchase order record or null if not found.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects None (Read-only)
   */
  async getPurchaseOrder(organizationId: string, id: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: purchaseOrderInclude,
    })
  },

  /**
   * Creates a new purchase order.
   * @param organizationId - Organization identifier.
   * @param data - Purchase order creation data including supplier, warehouse, and items.
   * @returns The created purchase order record.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects Creates new records in purchaseOrder and purchaseOrderItem tables.
   */
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
      include: purchaseOrderInclude,
    })
  },

  /**
   * Updates a purchase order.
   * @param organizationId - Organization identifier.
   * @param id - Purchase order identifier.
   * @param data - Purchase order update data including status, payment, supplier, and warehouse changes.
   * @returns The updated purchase order record, or an error object if not found or transition invalid.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects Updates records in purchaseOrder table. May create stockMovement records if amountPaid changes.
   */
  async updatePurchaseOrder(
    organizationId: string,
    id: string,
    data: {
      status?: PurchaseOrderStatus
      paymentStatus?: PurchaseOrderPaymentStatus
      paymentMethod?: string | null
      amountPaid?: number
      supplierId?: string
      warehouseId?: string
      orderedAt?: Date | null
      note?: string | null
    },
  ) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: purchaseOrderItemsInclude,
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

    if (data.amountPaid !== undefined) {
      const orderTotal = existing.items.reduce(
        (sum, item) => sum + Number(item.unitCost) * item.quantity,
        0,
      )
      const currentPaid = Number(existing.amountPaid)
      const newPaid = currentPaid + data.amountPaid
      const cappedPaid = Math.min(newPaid, orderTotal)
      if (cappedPaid >= orderTotal) {
        data.paymentStatus = 'PAID' as const
      } else if (cappedPaid > 0) {
        data.paymentStatus = 'PARTIALLY_PAID' as const
      } else {
        data.paymentStatus = 'UNPAID' as const
      }
      data.amountPaid = cappedPaid
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data,
      include: purchaseOrderInclude,
    })
  },

  /**
   * Receives items against a purchase order and updates stock.
   * @param organizationId - Organization identifier.
   * @param id - Purchase order identifier.
   * @param receivedItems - Array of items received with their quantities.
   * @returns The updated purchase order record, or an error object if not found or order not receivable.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects Updates purchaseOrderItem.receivedQty, creates stockMovement records (IN type), updates productVariant.stock, and sets purchaseOrder status to RECEIVED.
   */
  async receivePurchaseOrder(
    organizationId: string,
    id: string,
    receivedItems: Array<{ itemId: string; receivedQty: number }>,
  ) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: purchaseOrderItemsInclude,
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
      include: purchaseOrderInclude,
    })
  },

  /**
   * Deletes a purchase order.
   * @param organizationId - Organization identifier.
   * @param id - Purchase order identifier.
   * @returns The deleted purchase order record, or an error object if not found or not deletable.
   * @usage Used in purchase-orders.route.ts, purchase-orders.ai.ts
   * @sideEffects Deletes a record from the purchaseOrder table.
   */
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
