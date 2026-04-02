import { prisma } from '#integrations/prisma'
import {
  SalesOrderStatus,
  SalesOrderPaymentStatus,
} from '#generated/prisma/client'

const STATUS_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

const TERMINAL_STATUSES: SalesOrderStatus[] = ['COMPLETED', 'CANCELLED']

function buildUpdateData(data: {
  status?: SalesOrderStatus
  paymentStatus?: SalesOrderPaymentStatus
  paymentMethod?: string | null
  amountPaid?: number
  customerId?: string | null
  warehouseId?: string
  guestName?: string | null
  guestEmail?: string | null
  shippingAddress?: Record<string, unknown>
  orderedAt?: Date | null
  shippedAt?: Date | null
  note?: string | null
}) {
  const updateData: Record<string, unknown> = {}
  if (data.status !== undefined) updateData.status = data.status
  if (data.paymentStatus !== undefined)
    updateData.paymentStatus = data.paymentStatus
  if (data.paymentMethod !== undefined)
    updateData.paymentMethod = data.paymentMethod
  if (data.amountPaid !== undefined) updateData.amountPaid = data.amountPaid
  if (data.customerId !== undefined) updateData.customerId = data.customerId
  if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId
  if (data.guestName !== undefined) updateData.guestName = data.guestName
  if (data.guestEmail !== undefined) updateData.guestEmail = data.guestEmail
  if (data.shippingAddress !== undefined)
    updateData.shippingAddress = data.shippingAddress
  if (data.orderedAt !== undefined) updateData.orderedAt = data.orderedAt
  if (data.shippedAt !== undefined) updateData.shippedAt = data.shippedAt
  if (data.note !== undefined) updateData.note = data.note
  return updateData
}

export const salesOrdersService = {
  async listSalesOrders(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      status?: SalesOrderStatus
      paymentStatus?: SalesOrderPaymentStatus
      customerId?: string
      search?: string
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
      ...(params?.customerId && { customerId: params.customerId }),
      ...(params?.search && {
        OR: [
          { note: { contains: params.search, mode: 'insensitive' as const } },
          {
            guestEmail: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
          {
            guestName: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.salesOrder.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
          items: {
            include: {
              variant: { select: { id: true, sku: true, name: true } },
            },
          },
        },
      }),
      prisma.salesOrder.count({ where }),
    ])
    return { data, total }
  },

  async getSalesOrder(organizationId: string, id: string) {
    return prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async createSalesOrder(
    organizationId: string,
    data: {
      customerId?: string
      warehouseId: string
      guestName?: string
      guestEmail?: string
      shippingAddress?: unknown
      orderedAt?: Date
      note?: string
      paymentMethod?: 'CASH' | 'QRIS' | 'TRANSFER' | 'CARD'
      items: Array<{
        variantId: string
        quantity: number
        unitPrice: number
      }>
    },
  ) {
    if (!data.customerId && !data.guestName) {
      return { error: 'Either customerId or guestName must be provided' }
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId },
    })
    if (!warehouse) return { error: 'Warehouse not found' }

    if (data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, organizationId },
      })
      if (!customer) return { error: 'Customer not found' }
    }

    const variantIds = [...new Set(data.items.map((i) => i.variantId))]
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, organizationId },
      select: { id: true },
    })
    if (variants.length !== variantIds.length) {
      return { error: 'One or more product variants not found' }
    }

    return prisma.salesOrder.create({
      data: {
        organizationId,
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        shippingAddress: data.shippingAddress ?? {},
        orderedAt: data.orderedAt,
        note: data.note,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod
          ? ('PAID' as const)
          : ('UNPAID' as const),
        amountPaid: data.paymentMethod
          ? data.items.reduce(
              (sum, item) => sum + item.unitPrice * item.quantity,
              0,
            )
          : 0,
        items: {
          create: data.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async updateSalesOrder(
    organizationId: string,
    id: string,
    data: {
      status?: SalesOrderStatus
      paymentStatus?: SalesOrderPaymentStatus
      paymentMethod?: string | null
      amountPaid?: number
      customerId?: string | null
      warehouseId?: string
      guestName?: string | null
      guestEmail?: string | null
      shippingAddress?: Record<string, unknown>
      orderedAt?: Date | null
      shippedAt?: Date | null
      note?: string | null
    },
  ) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: { items: true },
    })
    if (!existing) return { error: 'not_found' as const }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      return {
        error: `Cannot modify a ${existing.status.toLowerCase()} sales order`,
      }
    }

    if (data.status) {
      const allowed = STATUS_TRANSITIONS[existing.status]
      if (!allowed.includes(data.status)) {
        return {
          error: `Cannot transition from ${existing.status} to ${data.status}`,
        }
      }
    }

    const resultCustomerId =
      data.customerId !== undefined ? data.customerId : existing.customerId
    const resultGuestName =
      data.guestName !== undefined ? data.guestName : existing.guestName
    if (!resultCustomerId && !resultGuestName) {
      return { error: 'Either customerId or guestName must be provided' }
    }

    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, organizationId },
      })
      if (!warehouse) return { error: 'Warehouse not found' }
    }

    if (data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, organizationId },
      })
      if (!customer) return { error: 'Customer not found' }
    }

    if (data.amountPaid !== undefined) {
      const orderTotal = existing.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      )
      const currentPaid = Number(existing.amountPaid)
      const newPaid = currentPaid + data.amountPaid
      const cappedPaid = Math.min(newPaid, orderTotal)
      const resolvedData = {
        ...data,
        amountPaid: cappedPaid,
      }
      if (cappedPaid >= orderTotal) {
        resolvedData.paymentStatus = 'PAID' as const
      } else if (cappedPaid > 0) {
        resolvedData.paymentStatus = 'PARTIALLY_PAID' as const
      } else {
        resolvedData.paymentStatus = 'UNPAID' as const
      }
      Object.assign(data, resolvedData)
    }

    if (data.status === 'SHIPPED') {
      return prisma.$transaction(async (tx) => {
        for (const item of existing.items) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: existing.warehouseId,
              variantId: item.variantId,
              type: 'OUT',
              quantity: item.quantity,
              referenceId: id,
              referenceType: 'sales_order',
            },
          })

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          })
        }

        return tx.salesOrder.update({
          where: { id },
          data: { ...buildUpdateData(data), shippedAt: new Date() },
          include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
            items: {
              include: {
                variant: { select: { id: true, sku: true, name: true } },
              },
            },
          },
        })
      })
    }

    if (data.status === 'CANCELLED' && existing.status === 'SHIPPED') {
      return prisma.$transaction(async (tx) => {
        for (const item of existing.items) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              warehouseId: existing.warehouseId,
              variantId: item.variantId,
              type: 'IN',
              quantity: item.quantity,
              referenceId: id,
              referenceType: 'sales_order',
            },
          })

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }

        return tx.salesOrder.update({
          where: { id },
          data: buildUpdateData(data),
          include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
            items: {
              include: {
                variant: { select: { id: true, sku: true, name: true } },
              },
            },
          },
        })
      })
    }

    return prisma.salesOrder.update({
      where: { id },
      data: buildUpdateData(data),
      include: {
        customer: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })
  },

  async deleteSalesOrder(organizationId: string, id: string) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return { error: 'not_found' as const }

    if (existing.status !== 'PENDING' && existing.status !== 'CANCELLED') {
      return {
        error: `Cannot delete a ${existing.status.toLowerCase()} sales order`,
      }
    }

    return prisma.salesOrder.delete({ where: { id } })
  },
}
