import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { stockMovementService } from "./stock-movements.service";
import { StockMovementType } from "@/generated/prisma/client";
import { errorResponse } from "@/common/error.response";
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from "@/common/pagination";

const movementTypeEnum = z.enum([
  StockMovementType.IN,
  StockMovementType.OUT,
  StockMovementType.ADJUSTMENT,
]);

const stockMovementSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  warehouseId: z.string(),
  variantId: z.string(),
  type: movementTypeEnum,
  quantity: z.number(),
  referenceId: z.string().nullable(),
  referenceType: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

const stockMovementWithRelationsSchema = stockMovementSchema.extend({
  variant: z.object({ id: z.string(), sku: z.string(), name: z.string() }),
  warehouse: z.object({ id: z.string(), name: z.string() }),
});

const createMovementDto = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().positive(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  note: z.string().optional(),
});

const listMovementsQuery = paginationQuery
  .merge(sortQuery(["createdAt", "quantity", "type"]))
  .extend({
    variantId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    type: movementTypeEnum.optional(),
  });

const movementIdParam = z.object({
  id: z.string().uuid(),
});

const serializeMovement = (m: {
  id: string;
  organizationId: string;
  warehouseId: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  referenceId: string | null;
  referenceType: string | null;
  note: string | null;
  createdAt: Date;
  variant: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string };
}) => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
});

export const stockMovementRoute = new Elysia({
  prefix: "/stock-movements",
  tags: ["Stock Movements"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization, query }) => {
      const {
        page,
        pageSize,
        variantId,
        warehouseId,
        type,
        sortBy,
        sortOrder,
      } = query;
      const { skip, take } = paginationToSkipTake(page, pageSize);
      const { data, total } = await stockMovementService.listMovements(
        organization.id,
        {
          skip,
          take,
          variantId,
          warehouseId,
          type,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? "desc" }
            : undefined,
        },
      );
      return {
        data: data.map(serializeMovement),
        meta: buildPaginationMeta(total, page, pageSize),
      };
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: listMovementsQuery,
      response: {
        200: paginatedResponse(stockMovementWithRelationsSchema),
      },
      detail: {
        summary: "List stock movements",
        description:
          "Retrieves a paginated list of stock movements for the authenticated organization. Supports filtering by variant, warehouse, and movement type.",
      },
    },
  )
  .post(
    "/",
    async ({ organization, body, status }) => {
      const movement = await stockMovementService.createMovement(
        organization.id,
        body,
      );
      return status(201, serializeMovement(movement));
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ["adjust"] },
      body: createMovementDto,
      response: {
        201: stockMovementWithRelationsSchema,
      },
      detail: {
        summary: "Create a stock movement",
        description:
          "Records a new stock movement (IN, OUT, or ADJUSTMENT) and atomically updates the variant's stock cache.",
      },
    },
  )
  .get(
    "/:id",
    async ({ organization, params, status }) => {
      const movement = await stockMovementService.getMovement(
        organization.id,
        params.id,
      );
      if (!movement)
        return status(404, { message: "Stock movement not found" });
      return serializeMovement(movement);
    },
    {
      requireAuth: true,
      requireOrg: true,
      params: movementIdParam,
      response: {
        200: stockMovementWithRelationsSchema,
        404: errorResponse,
      },
      detail: {
        summary: "Get a stock movement",
        description:
          "Retrieves the details of a specific stock movement by its ID.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ organization, params, status }) => {
      const deleted = await stockMovementService.deleteMovement(
        organization.id,
        params.id,
      );
      if (!deleted) return status(404, { message: "Stock movement not found" });
      return status(200, { message: "Stock movement deleted" });
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { stock: ["adjust"] },
      params: movementIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Delete a stock movement",
        description:
          "Deletes a stock movement and reverses its effect on the variant stock cache atomically.",
      },
    },
  );
