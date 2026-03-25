import { Elysia } from "elysia"
import { z } from "zod"
import { authPlugin } from "@/plugins/auth.plugin"
import { purchaseOrdersService } from "./purchase-orders.service"
import { errorResponse } from "@/common/error.response"
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from "@/common/pagination"

const purchaseOrderItemSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  variantId: z.string(),
  variant: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
  }),
  quantity: z.number().int(),
  unitCost: z.string(),
  receivedQty: z.number().int(),
})

const purchaseOrderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  supplierId: z.string(),
  supplier: z.object({
    id: z.string(),
    name: z.string(),
  }),
  warehouseId: z.string(),
  warehouse: z.object({
    id: z.string(),
    name: z.string(),
  }),
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "RECEIVED", "COMPLETED", "CANCELLED"]),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]),
  orderedAt: z.iso.datetime().nullable(),
  receivedAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(purchaseOrderItemSchema),
})

const createPurchaseOrderItemDto = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
})

const createPurchaseOrderDto = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  orderedAt: z.iso.datetime().optional(),
  note: z.string().optional(),
  items: z.array(createPurchaseOrderItemDto).min(1),
})

const updatePurchaseOrderDto = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "SHIPPED", "COMPLETED", "CANCELLED"])
    .optional(),
  paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  supplierId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  orderedAt: z.iso.datetime().nullable().optional(),
  note: z.string().nullable().optional(),
})

const receiveItemDto = z.object({
  itemId: z.string().uuid(),
  receivedQty: z.number().int().positive(),
})

const receivePurchaseOrderDto = z.object({
  items: z.array(receiveItemDto).min(1),
})

const listPurchaseOrdersQuery = paginationQuery
  .extend(sortQuery(["createdAt", "updatedAt", "orderedAt"]).shape)
  .extend({
    status: z
      .enum(["PENDING", "CONFIRMED", "SHIPPED", "RECEIVED", "COMPLETED", "CANCELLED"])
      .optional(),
    paymentStatus: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
    supplierId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
  })

const purchaseOrderIdParam = z.object({
  id: z.string().uuid(),
})

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderDto>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderDto>
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderDto>
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuery>

const serializePurchaseOrder = (po: {
  id: string
  organizationId: string
  supplierId: string
  supplier: { id: string; name: string }
  warehouseId: string
  warehouse: { id: string; name: string }
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "RECEIVED" | "COMPLETED" | "CANCELLED"
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID"
  orderedAt: Date | null
  receivedAt: Date | null
  note: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    purchaseOrderId: string
    variantId: string
    variant: { id: string; sku: string; name: string }
    quantity: number
    unitCost: { toString: () => string }
    receivedQty: number
  }>
}) => ({
  ...po,
  orderedAt: po.orderedAt?.toISOString() ?? null,
  receivedAt: po.receivedAt?.toISOString() ?? null,
  createdAt: po.createdAt.toISOString(),
  updatedAt: po.updatedAt.toISOString(),
  items: po.items.map((item) => ({
    ...item,
    unitCost: item.unitCost.toString(),
  })),
})

export const purchaseOrdersRoute = new Elysia({
  prefix: "/purchase-orders",
  tags: ["Purchase Orders"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization, query }) => {
      const { page, pageSize, sortBy, sortOrder, status, paymentStatus, supplierId, warehouseId } =
        query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await purchaseOrdersService.listPurchaseOrders(organization.id, {
        skip,
        take,
        status,
        paymentStatus,
        supplierId,
        warehouseId,
        orderBy: sortBy ? { field: sortBy, order: sortOrder ?? "desc" } : undefined,
      })
      return {
        data: data.map(serializePurchaseOrder),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: listPurchaseOrdersQuery,
      response: {
        200: paginatedResponse(purchaseOrderSchema),
      },
      detail: {
        summary: "List purchase orders",
        description:
          "Retrieves a paginated list of purchase orders for the authenticated organization. Supports filtering by status, payment status, supplier, and warehouse.",
      },
    },
  )
  .post(
    "/",
    async ({ organization, body, status }) => {
      const order = await purchaseOrdersService.createPurchaseOrder(organization.id, {
        ...body,
        orderedAt: body.orderedAt ? new Date(body.orderedAt) : undefined,
      })
      return status(201, serializePurchaseOrder(order))
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { purchaseOrder: ["create"] },
      body: createPurchaseOrderDto,
      response: {
        201: purchaseOrderSchema,
      },
      detail: {
        summary: "Create a purchase order",
        description:
          "Creates a new purchase order with line items for the authenticated organization.",
      },
    },
  )
  .get(
    "/:id",
    async ({ organization, params, status }) => {
      const order = await purchaseOrdersService.getPurchaseOrder(organization.id, params.id)
      if (!order) return status(404, { message: "Purchase order not found" })
      return serializePurchaseOrder(order)
    },
    {
      requireAuth: true,
      requireOrg: true,
      params: purchaseOrderIdParam,
      response: {
        200: purchaseOrderSchema,
        404: errorResponse,
      },
      detail: {
        summary: "Get a purchase order",
        description: "Retrieves the details of a specific purchase order by its ID, including all line items.",
      },
    },
  )
  .patch(
    "/:id",
    async ({ organization, params, body, status }) => {
      const result = await purchaseOrdersService.updatePurchaseOrder(
        organization.id,
        params.id,
        {
          ...body,
          orderedAt: body.orderedAt !== undefined ? (body.orderedAt ? new Date(body.orderedAt) : null) : undefined,
        },
      )
      if ("error" in result) {
        if (result.error === "not_found") return status(404, { message: "Purchase order not found" })
        return status(400, { message: result.error })
      }
      return serializePurchaseOrder(result)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { purchaseOrder: ["update"] },
      params: purchaseOrderIdParam,
      body: updatePurchaseOrderDto,
      response: {
        200: purchaseOrderSchema,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Update a purchase order",
        description:
          "Updates the status, payment status, or other fields of an existing purchase order. RECEIVED status cannot be set here — use the /receive endpoint. COMPLETED requires all items to be fully received.",
      },
    },
  )
  .post(
    "/:id/receive",
    async ({ organization, params, body, status }) => {
      const result = await purchaseOrdersService.receivePurchaseOrder(
        organization.id,
        params.id,
        body.items,
      )
      if (result && "error" in result) {
        if (result.error === "not_found") return status(404, { message: "Purchase order not found" })
        return status(400, { message: result.error })
      }
      if (!result) return status(404, { message: "Purchase order not found" })
      return serializePurchaseOrder(result)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { purchaseOrder: ["receive"] },
      params: purchaseOrderIdParam,
      body: receivePurchaseOrderDto,
      response: {
        200: purchaseOrderSchema,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Receive a purchase order",
        description:
          "Marks items as received on a purchase order. Only allowed when status is CONFIRMED or SHIPPED. Updates received quantities and creates stock-in movements.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ organization, params, status }) => {
      const result = await purchaseOrdersService.deletePurchaseOrder(organization.id, params.id)
      if ("error" in result) {
        if (result.error === "not_found") return status(404, { message: "Purchase order not found" })
        return status(400, { message: result.error })
      }
      return status(200, { message: "Purchase order deleted" })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { purchaseOrder: ["delete"] },
      params: purchaseOrderIdParam,
      response: {
        200: errorResponse,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Delete a purchase order",
        description: "Permanently deletes a purchase order. Only allowed when status is PENDING.",
      },
    },
  )
