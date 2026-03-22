import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { auth } from "./integrations/auth";
import { z } from "zod";
import { logger } from "./libraries/utilities";
import { productsRoute } from "@/modules/products/products.route";
import { variantsRoute } from "@/modules/variants/variants.route";
import { warehousesRoute } from "@/modules/warehouses/warehouses.route";
import { stockMovementRoute } from "@/modules/stock-movements/stock-movements.route";
import { suppliersRoute } from "@/modules/suppliers/suppliers.route";
import { customersRoute } from "@/modules/customers/customers.route";
import { purchaseOrdersRoute } from "@/modules/purchase-orders/purchase-orders.route";
import { salesOrdersRoute } from "@/modules/sales-orders/sales-orders.route";
import { apiKeysRoute } from "@/modules/api-keys/api-keys.route";

const app = new Elysia()
  .onError(({ error }) => {
    logger.error(error);
  })
  .onAfterResponse(({ path, request, set }) => {
    const { method } = request;
    logger.info(
      `[${new Date().toDateString()}] ${path} ${method} → ${set.status}`,
    );
  })
  .use(
    openapi({
      documentation: {
        info: {
          title: "BearUang API",
          version: "1.0.0",
          description: "API documentation for BearUang",
        },
        tags: [
          { name: "Products", description: "Product management endpoints" },
          {
            name: "Variants",
            description: "Product variant management endpoints",
          },
          { name: "Warehouses", description: "Warehouse management endpoints" },
          {
            name: "Stock Movements",
            description: "Stock movement tracking endpoints",
          },
          { name: "Suppliers", description: "Supplier management endpoints" },
          { name: "Customers", description: "Customer management endpoints" },
          { name: "Purchase Orders", description: "Purchase order management endpoints" },
          { name: "Sales Orders", description: "Sales order management endpoints" },
          { name: "API Keys", description: "API key management endpoints" },
        ],
      },
      mapJsonSchema: { zod: z.toJSONSchema },
      exclude: {
        methods: ["OPTIONS"],
      },
      path: "/openapi",
      specPath: "/openapi/json",
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
  .get("/health", () => "ok")
  .listen(Number(process.env.PORT) || 8000);

logger.info(
  `🦊 BearUang API is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
