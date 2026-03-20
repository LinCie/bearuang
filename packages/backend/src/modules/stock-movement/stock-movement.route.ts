import { Elysia } from "elysia"
import { z } from "zod"
import { authPlugin } from "@/plugins/auth.plugin"
import { stockMovementService } from "./stock-movement.service"
import { StockMovementType } from "@/generated/prisma/client"

const movementTypeEnum = z.enum([
  StockMovementType.IN,
  StockMovementType.OUT,
  StockMovementType.ADJUSTMENT,
])

const createMovementDto = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().positive(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  note: z.string().optional(),
})

const listMovementsQuery = z.object({
  skip: z.coerce.number().int().nonnegative().optional(),
  take: z.coerce.number().int().positive().max(200).optional(),
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  type: movementTypeEnum.optional(),
})

const movementIdParam = z.object({
  id: z.string().uuid(),
})

export const stockMovementRoute = new Elysia({
  prefix: "/stock-movements",
  tags: ["Stock Movements"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization, query }) => {
      return stockMovementService.listMovements(organization.id, query)
    },
    {
      requireOrg: true,
      query: listMovementsQuery,
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
      )
      return status(201, movement)
    },
    {
      requireOrg: true,
      body: createMovementDto,
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
      )
      if (!movement) return status(404)
      return movement
    },
    {
      requireOrg: true,
      params: movementIdParam,
      detail: {
        summary: "Get a stock movement",
        description: "Retrieves the details of a specific stock movement by its ID.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ organization, params, status }) => {
      const deleted = await stockMovementService.deleteMovement(
        organization.id,
        params.id,
      )
      if (!deleted) return status(404)
      return status(200)
    },
    {
      requireOrg: true,
      params: movementIdParam,
      detail: {
        summary: "Delete a stock movement",
        description:
          "Deletes a stock movement and reverses its effect on the variant stock cache atomically.",
      },
    },
  )
