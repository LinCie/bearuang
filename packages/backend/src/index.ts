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
import { purchaseOrdersRoute } from "@/modules/purchase-orders/purchase-orders.route";

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
          { name: "Purchase Orders", description: "Purchase order management endpoints" },
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
  .use(purchaseOrdersRoute)
  .get("/health", () => "ok")
  .listen(3000);

logger.info(
  `🦊 BearUang API is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
