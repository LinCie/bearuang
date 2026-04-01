import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { auth } from './integrations/auth'
import { z } from 'zod'
import { logger } from './libraries/utilities'
import { productsRoute } from '#modules/products/products.route'
import { variantsRoute } from '#modules/variants/variants.route'
import { warehousesRoute } from '#modules/warehouses/warehouses.route'
import { stockMovementRoute } from '#modules/stock-movements/stock-movements.route'
import { suppliersRoute } from '#modules/suppliers/suppliers.route'
import { customersRoute } from '#modules/customers/customers.route'
import { purchaseOrdersRoute } from '#modules/purchase-orders/purchase-orders.route'
import { salesOrdersRoute } from '#modules/sales-orders/sales-orders.route'
import { apiKeysRoute } from '#modules/api-keys/api-keys.route'
import { membersRoute } from '#modules/members/members.route'
import { invitationsRoute } from '#modules/invitations/invitations.route'
import { rolesRoute } from '#modules/roles/roles.route'
import { permissionsRoute } from '#modules/permissions/permissions.route'
import { dashboardRoute } from '#modules/dashboard/dashboard.route'
import { uploadsRoute } from '#modules/uploads/uploads.route'
import { auditRoute } from '#modules/audit/audit.route'
import { productCategoriesRoute } from '#modules/product-categories/product-categories.route'
import { syncRoute } from '#modules/sync/sync.route'

const app = new Elysia()
  .onError(({ error }) => {
    logger.error(error)
  })
  .onAfterResponse(({ path, request, set }) => {
    const { method } = request
    logger.info(
      `[${new Date().toDateString()}] ${path} ${method} → ${set.status}`,
    )
  })
  .use(
    openapi({
      documentation: {
        info: {
          title: 'BearUang API',
          version: '1.0.0',
          description: 'API documentation for BearUang',
        },
        tags: [
          { name: 'Products', description: 'Product management endpoints' },
          {
            name: 'Variants',
            description: 'Product variant management endpoints',
          },
          { name: 'Warehouses', description: 'Warehouse management endpoints' },
          {
            name: 'Stock Movements',
            description: 'Stock movement tracking endpoints',
          },
          { name: 'Suppliers', description: 'Supplier management endpoints' },
          { name: 'Customers', description: 'Customer management endpoints' },
          {
            name: 'Purchase Orders',
            description: 'Purchase order management endpoints',
          },
          {
            name: 'Sales Orders',
            description: 'Sales order management endpoints',
          },
          { name: 'API Keys', description: 'API key management endpoints' },
          {
            name: 'Members',
            description: 'Organization member management endpoints',
          },
          {
            name: 'Invitations',
            description: 'Organization invitation management endpoints',
          },
          { name: 'Roles', description: 'Custom role management endpoints' },
          {
            name: 'Dashboard',
            description: 'Dashboard summary and metrics endpoints',
          },
          {
            name: 'Uploads',
            description: 'File upload and media management endpoints',
          },
          {
            name: 'Audit Logs',
            description: 'Audit log viewing endpoints',
          },
          {
            name: 'Product Categories',
            description: 'Product category management endpoints',
          },
        ],
      },
      mapJsonSchema: { zod: z.toJSONSchema },
      exclude: {
        methods: ['OPTIONS'],
      },
      path: '/openapi',
      specPath: '/openapi/json',
    }),
  )
  .use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    }),
  )
  .mount(auth.handler)
  .use(productsRoute)
  .use(variantsRoute)
  .use(warehousesRoute)
  .use(stockMovementRoute)
  .use(suppliersRoute)
  .use(customersRoute)
  .use(purchaseOrdersRoute)
  .use(salesOrdersRoute)
  .use(apiKeysRoute)
  .use(membersRoute)
  .use(invitationsRoute)
  .use(rolesRoute)
  .use(permissionsRoute)
  .use(dashboardRoute)
  .use(uploadsRoute)
  .use(auditRoute)
  .use(productCategoriesRoute)
  .use(syncRoute)
  .get('/health', () => 'ok')
  .listen(Number(process.env.PORT) || 8000)

logger.info(
  `🦊 BearUang API is running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
