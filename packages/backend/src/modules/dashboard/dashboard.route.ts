import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { dashboardService } from './dashboard.service'

// ─── Schemas ──────────────────────────────────────────────────

const summarySchema = z.object({
  weeklySales: z.number(),
  monthlyRevenue: z.number(),
  pendingPickup: z.number().int(),
  activeCustomers: z.number().int(),
})

const recentOrderSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  firstItemName: z.string(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ]),
  totalPrice: z.number(),
  createdAt: z.iso.datetime(),
})

const recentOrdersResponseSchema = z.array(recentOrderSchema)

const ordersPresetSchema = z.enum(['today', 'this-week', 'this-month'])

const ordersReportSchema = z.object({
  preset: z.string(),
  verdict: z.enum(['great', 'normal', 'slow']),
  currentRevenue: z.number(),
  previousRevenue: z.number(),
  changePercent: z.number(),
  orderCount: z.number().int(),
  previousOrderCount: z.number().int(),
})

const stockReportItemSchema = z.object({
  variantId: z.string(),
  variantName: z.string(),
  productName: z.string(),
  stock: z.number().int(),
})

const stockReportSchema = z.object({
  verdict: z.enum(['healthy', 'running-low', 'critical', 'normal']),
  totalVariants: z.number().int(),
  outOfStockCount: z.number().int(),
  lowStockCount: z.number().int(),
  lowStockPercentage: z.number(),
  topItems: z.array(stockReportItemSchema),
})

// ─── Route ────────────────────────────────────────────────────

export const dashboardRoute = new Elysia({
  prefix: '/dashboard',
  tags: ['Dashboard'],
})
  .use(authPlugin)
  .get(
    '/summary',
    async ({ organization }) => {
      return dashboardService.getSummary(organization.id)
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: summarySchema,
      },
      detail: {
        summary: 'Get dashboard summary metrics',
        description:
          'Returns weekly sales, monthly revenue, pending pickup count, and active customer count for the authenticated organization.',
      },
    },
  )
  .get(
    '/recent-orders',
    async ({ organization }) => {
      return dashboardService.getRecentOrders(organization.id)
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: recentOrdersResponseSchema,
      },
      detail: {
        summary: 'Get recent sales orders',
        description:
          'Returns the 5 most recent sales orders with customer name, first item name, status, and total price.',
      },
    },
  )
  .get(
    '/reports/orders',
    async ({ organization, query }) => {
      return dashboardService.getOrdersReport(organization.id, query.preset)
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: z.object({
        preset: ordersPresetSchema.default('today'),
      }),
      response: {
        200: ordersReportSchema,
      },
      detail: {
        summary: 'Get orders report with verdict',
        description:
          'Returns revenue comparison and verdict for the given preset period (today, this-week, this-month) against the equivalent previous period.',
      },
    },
  )
  .get(
    '/reports/stock',
    async ({ organization }) => {
      return dashboardService.getStockReport(organization.id)
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: stockReportSchema,
      },
      detail: {
        summary: 'Get stock health report with verdict',
        description:
          'Returns stock level analysis with verdict (healthy, running-low, critical) and the top 5 lowest-stock variants.',
      },
    },
  )
