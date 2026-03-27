import { prisma } from '@/integrations/prisma'

/**
 * Returns the Monday 00:00:00 of the current week.
 */
function getWeekStartMonday(): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1 // how many days since Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Returns the first day of the current month at 00:00:00.
 */
function getMonthStart(): Date {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  first.setHours(0, 0, 0, 0)
  return first
}

export const dashboardService = {
  /**
   * Get summary metrics for the dashboard.
   */
  async getSummary(organizationId: string) {
    const weekStart = getWeekStartMonday()
    const monthStart = getMonthStart()

    // Weekly sales: sum of items for COMPLETED or DELIVERED orders created this week
    const weeklyOrders = await prisma.salesOrder.findMany({
      where: {
        organizationId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: weekStart },
      },
      select: {
        items: {
          select: { quantity: true, unitPrice: true },
        },
      },
    })

    const weeklySales = weeklyOrders.reduce((total, order) => {
      const orderTotal = order.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0,
      )
      return total + orderTotal
    }, 0)

    // Monthly revenue: sum of items for COMPLETED or DELIVERED orders created this month
    const monthlyOrders = await prisma.salesOrder.findMany({
      where: {
        organizationId,
        status: { in: ['COMPLETED', 'DELIVERED'] },
        createdAt: { gte: monthStart },
      },
      select: {
        items: {
          select: { quantity: true, unitPrice: true },
        },
      },
    })

    const monthlyRevenue = monthlyOrders.reduce((total, order) => {
      const orderTotal = order.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0,
      )
      return total + orderTotal
    }, 0)

    // Pending pickup: count of SHIPPED orders (shipped but not yet delivered)
    const pendingPickup = await prisma.salesOrder.count({
      where: {
        organizationId,
        status: 'SHIPPED',
      },
    })

    // Active customers
    const activeCustomers = await prisma.customer.count({
      where: {
        organizationId,
        isActive: true,
      },
    })

    return {
      weeklySales,
      monthlyRevenue,
      pendingPickup,
      activeCustomers,
    }
  },

  /**
   * Get the 5 most recent sales orders with customer and first item info.
   */
  async getRecentOrders(organizationId: string) {
    const orders = await prisma.salesOrder.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          take: 1,
          include: {
            variant: { select: { id: true, name: true } },
          },
        },
      },
    })

    return orders.map((order) => {
      const total = order.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0,
      )
      return {
        id: order.id,
        customerName: order.customer?.name ?? order.guestName ?? 'Tanpa Nama',
        firstItemName: order.items[0]?.variant.name ?? '-',
        status: order.status,
        totalPrice: total,
        createdAt: order.createdAt.toISOString(),
      }
    })
  },
}
