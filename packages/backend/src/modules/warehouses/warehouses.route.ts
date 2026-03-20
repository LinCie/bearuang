import { Elysia } from "elysia"
import { z } from "zod"
import { authPlugin } from "@/plugins/auth.plugin"
import { warehousesService } from "./warehouses.service"

const createWarehouseDto = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

const updateWarehouseDto = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
})

const warehouseIdParam = z.object({
  id: z.string().uuid(),
})

export const warehousesRoute = new Elysia({
  prefix: "/warehouses",
  tags: ["Warehouses"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization }) => {
      return warehousesService.listWarehouses(organization.id)
    },
    {
      requireOrg: true,
      detail: {
        summary: "List warehouses",
        description: "Retrieves a list of all warehouses belonging to the authenticated organization.",
      },
    },
  )
  .post(
    "/",
    async ({ organization, body, status }) => {
      const warehouse = await warehousesService.createWarehouse(
        organization.id,
        body,
      )
      return status(201, warehouse)
    },
    {
      requireOrg: true,
      body: createWarehouseDto,
      detail: {
        summary: "Create a warehouse",
        description: "Creates a new warehouse for the authenticated organization.",
      },
    },
  )
  .get(
    "/:id",
    async ({ organization, params, status }) => {
      const warehouse = await warehousesService.getWarehouse(
        organization.id,
        params.id,
      )
      if (!warehouse) return status(404)
      return warehouse
    },
    {
      requireOrg: true,
      params: warehouseIdParam,
      detail: {
        summary: "Get a warehouse",
        description: "Retrieves the details of a specific warehouse by its ID.",
      },
    },
  )
  .patch(
    "/:id",
    async ({ organization, params, body, status }) => {
      const count = await warehousesService.updateWarehouse(
        organization.id,
        params.id,
        body,
      )
      if (count.count === 0) return status(404)
      return status(200)
    },
    {
      requireOrg: true,
      params: warehouseIdParam,
      body: updateWarehouseDto,
      detail: {
        summary: "Update a warehouse",
        description: "Updates the details of an existing warehouse.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ organization, params, status }) => {
      const count = await warehousesService.deleteWarehouse(
        organization.id,
        params.id,
      )
      if (count.count === 0) return status(404)
      return status(200)
    },
    {
      requireOrg: true,
      params: warehouseIdParam,
      detail: {
        summary: "Delete a warehouse",
        description: "Permanently deletes a warehouse by its ID.",
      },
    },
  )
