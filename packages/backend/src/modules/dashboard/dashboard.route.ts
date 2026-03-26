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
