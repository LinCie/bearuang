import { prisma } from '#integrations/prisma'

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

type OrdersPreset = 'today' | 'this-week' | 'this-month'

function getDateRange(preset: OrdersPreset) {
  const now = new Date()

  if (preset === 'today') {
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    )
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    return {
      current: { start: todayStart, end: now },
      previous: { start: yesterdayStart, end: todayStart },
    }
  }

  if (preset === 'this-week') {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diff,
    )
    monday.setHours(0, 0, 0, 0)
    const prevMonday = new Date(monday)
    prevMonday.setDate(prevMonday.getDate() - 7)
    return {
      current: { start: monday, end: now },
      previous: { start: prevMonday, end: monday },
    }
  }

  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  firstThisMonth.setHours(0, 0, 0, 0)
  const daysElapsed = now.getDate()
  const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const endDay = Math.min(daysElapsed, lastDayPrevMonth.getDate())
  const firstPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  firstPrevMonth.setHours(0, 0, 0, 0)
  const prevPeriodEnd = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    endDay + 1,
  )
  prevPeriodEnd.setHours(0, 0, 0, 0)
  return {
    current: { start: firstThisMonth, end: now },
    previous: { start: firstPrevMonth, end: prevPeriodEnd },
  }
}

function sumOrderRevenue(
  orders: Array<{
    status: string
    items: Array<{ quantity: number; unitPrice: { toString: () => string } }>
  }>,
): number {
  return orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED')
    .reduce(
      (total, order) =>
        total +
        order.items.reduce(
          (sum, item) => sum + item.quantity * Number(item.unitPrice),
          0,
        ),
      0,
    )
}

type OrdersVerdict = 'great' | 'normal' | 'slow'
type StockVerdict = 'healthy' | 'running-low' | 'critical' | 'normal'

function computeOrdersVerdict(
  currentRevenue: number,
  previousRevenue: number,
  changePercent: number,
  orderCount: number,
): OrdersVerdict {
  const hour = new Date().getHours()
  if (hour < 10 && orderCount === 0) return 'normal'
  if (orderCount === 0) return 'slow'
  if (previousRevenue === 0 && currentRevenue > 0) return 'great'
  if (previousRevenue === 0 && currentRevenue === 0) return 'normal'
  if (changePercent > 10) return 'great'
  if (changePercent < -30) return 'slow'
  return 'normal'
}

const orderItemsRevenueSelect = {
  items: { select: { quantity: true, unitPrice: true } },
} as const

const recentOrderInclude = {
  customer: { select: { id: true, name: true } },
  items: {
    take: 1,
    include: { variant: { select: { id: true, name: true } } },
  },
} as const

const productSimpleSelect = {
  product: { select: { name: true } },
} as const

const orderStatusItemsSelect = {
  status: true,
  items: { select: { quantity: true, unitPrice: true } },
} as const

const recentOrderOrderBy = { createdAt: 'desc' } as const

const lowStockOrderBy = { stock: 'asc' } as const

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
      select: orderItemsRevenueSelect,
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
      select: orderItemsRevenueSelect,
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
      orderBy: recentOrderOrderBy,
      take: 5,
      include: recentOrderInclude,
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

  async getOrdersReport(organizationId: string, preset: OrdersPreset) {
    const { current, previous } = getDateRange(preset)

    const [currentOrders, previousOrders] = await prisma.$transaction([
      prisma.salesOrder.findMany({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: current.start, lt: current.end },
        },
        select: orderStatusItemsSelect,
      }),
      prisma.salesOrder.findMany({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: previous.start, lt: previous.end },
        },
        select: orderStatusItemsSelect,
      }),
    ])

    const currentRevenue = sumOrderRevenue(currentOrders)
    const previousRevenue = sumOrderRevenue(previousOrders)
    const changePercent =
      previousRevenue === 0
        ? currentRevenue > 0
          ? 100
          : 0
        : ((currentRevenue - previousRevenue) / previousRevenue) * 100

    return {
      preset,
      verdict: computeOrdersVerdict(
        currentRevenue,
        previousRevenue,
        changePercent,
        currentOrders.length,
      ),
      currentRevenue,
      previousRevenue,
      changePercent: Math.round(changePercent * 10) / 10,
      orderCount: currentOrders.length,
      previousOrderCount: previousOrders.length,
    }
  },

  async getStockReport(organizationId: string) {
    const baseWhere = {
      organizationId,
      deletedAt: null,
      product: { deletedAt: null },
    }

    const [totalVariants, outOfStockCount, lowStockCount, topItems] =
      await prisma.$transaction([
        prisma.productVariant.count({ where: baseWhere }),
        prisma.productVariant.count({ where: { ...baseWhere, stock: 0 } }),
        prisma.productVariant.count({
          where: { ...baseWhere, stock: { gt: 0, lte: 5 } },
        }),
        prisma.productVariant.findMany({
          where: { ...baseWhere, stock: { lte: 5 } },
          orderBy: lowStockOrderBy,
          take: 5,
          include: productSimpleSelect,
        }),
      ])

    const lowStockPercentage =
      totalVariants === 0
        ? 0
        : ((outOfStockCount + lowStockCount) / totalVariants) * 100

    const verdict: StockVerdict =
      totalVariants === 0
        ? 'normal'
        : lowStockPercentage < 10
          ? 'healthy'
          : lowStockPercentage <= 25
            ? 'running-low'
            : 'critical'

    return {
      verdict,
      totalVariants,
      outOfStockCount,
      lowStockCount,
      lowStockPercentage: Math.round(lowStockPercentage * 10) / 10,
      topItems: topItems.map((v) => ({
        variantId: v.id,
        variantName: v.name,
        productName: v.product.name,
        stock: v.stock,
      })),
    }
  },
}
