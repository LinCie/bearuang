import { describe, it, expect, mock, beforeAll } from "bun:test"
import { Elysia } from "elysia"

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const MOCK_PO_ID = "b1ffb0aa-0d1c-4ef8-bb7e-7cc0ce491b22"
const MOCK_SUPPLIER_ID = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f"
const MOCK_WAREHOUSE_ID = "d3fee8c8-9a3c-4fb7-ae4e-af9f3d4e5f60"
const MOCK_VARIANT_ID = "e4aff9d9-ab4d-4c8a-b6f5-ba0a4e5f6a71"
const MOCK_ITEM_ID = "f5baa0ea-bc5e-4d9b-a7a6-cb1b5f6a7b82"
const UNKNOWN_ID = "99999999-9999-4999-a999-999999999999"

const mockItem = {
  id: MOCK_ITEM_ID,
  purchaseOrderId: MOCK_PO_ID,
  variantId: MOCK_VARIANT_ID,
  variant: { id: MOCK_VARIANT_ID, sku: "SKU-001", name: "Widget Blue" },
  quantity: 10,
  unitCost: { toString: () => "25.00" },
  receivedQty: 0,
}

const mockPurchaseOrder = {
  id: MOCK_PO_ID,
  organizationId: MOCK_ORG_ID,
  supplierId: MOCK_SUPPLIER_ID,
  supplier: { id: MOCK_SUPPLIER_ID, name: "Acme Corp" },
  warehouseId: MOCK_WAREHOUSE_ID,
  warehouse: { id: MOCK_WAREHOUSE_ID, name: "Main Warehouse" },
  status: "PENDING" as const,
  paymentStatus: "UNPAID" as const,
  orderedAt: null,
  receivedAt: null,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockItem],
}

const mockService = {
  listPurchaseOrders: mock(() =>
    Promise.resolve({ data: [mockPurchaseOrder], total: 1 }),
  ),
  getPurchaseOrder: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_PO_ID ? mockPurchaseOrder : null),
  ),
  createPurchaseOrder: mock(() => Promise.resolve(mockPurchaseOrder)),
  updatePurchaseOrder: mock((orgId: string, id: string, data: any) => {
    if (id !== MOCK_PO_ID) return Promise.resolve({ error: "not_found" })
    if (data.status === "SHIPPED")
      return Promise.resolve({ error: "Cannot transition from PENDING to SHIPPED" })
    if (data.status === "COMPLETED")
      return Promise.resolve({ error: "Cannot complete order: not all items have been fully received" })
    return Promise.resolve(mockPurchaseOrder)
  }),
  receivePurchaseOrder: mock((orgId: string, id: string) => {
    if (id !== MOCK_PO_ID) return Promise.resolve({ error: "not_found" })
    return Promise.resolve(mockPurchaseOrder)
  }),
  deletePurchaseOrder: mock((orgId: string, id: string) => {
    if (id !== MOCK_PO_ID) return Promise.resolve({ error: "not_found" })
    return Promise.resolve(mockPurchaseOrder)
  }),
}

mock.module("@/plugins/auth.plugin", () => ({
  authPlugin: new Elysia({ name: "auth" }).macro({
    requireAuth: {
      resolve: () => ({
        user: { id: "user-1", name: "Test User", email: "test@test.com" },
        session: { id: "session-1" },
      }),
    },
    requireOrg: {
      resolve: () => ({
        organization: { id: MOCK_ORG_ID, name: "Test Org" },
      }),
    },
  }),
}))

mock.module("./purchase-orders.service", () => ({
  purchaseOrdersService: mockService,
}))

let app: any

beforeAll(async () => {
  const { purchaseOrdersRoute } = await import("./purchase-orders.route")
  app = new Elysia().use(purchaseOrdersRoute)
})

describe("Purchase Orders", () => {
  describe("GET /purchase-orders", () => {
    it("returns a paginated list of purchase orders", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_PO_ID)
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(1)
    })

    it("accepts status filter", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders?status=PENDING"),
      )

      expect(res.status).toBe(200)
    })

    it("accepts paymentStatus filter", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders?paymentStatus=UNPAID"),
      )

      expect(res.status).toBe(200)
    })

    it("accepts supplierId filter", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/purchase-orders?supplierId=${MOCK_SUPPLIER_ID}`,
        ),
      )

      expect(res.status).toBe(200)
    })

    it("accepts warehouseId filter", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/purchase-orders?warehouseId=${MOCK_WAREHOUSE_ID}`,
        ),
      )

      expect(res.status).toBe(200)
    })

    it("accepts sort params", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/purchase-orders?sortBy=createdAt&sortOrder=asc",
        ),
      )

      expect(res.status).toBe(200)
    })

    it("returns 422 for invalid status value", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders?status=INVALID"),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid paymentStatus value", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders?paymentStatus=INVALID"),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid sortBy value", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders?sortBy=invalidField"),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("POST /purchase-orders", () => {
    it("creates a purchase order and returns 201", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: MOCK_SUPPLIER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 10, unitCost: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(MOCK_PO_ID)
      expect(data.supplierId).toBe(MOCK_SUPPLIER_ID)
      expect(data.warehouseId).toBe(MOCK_WAREHOUSE_ID)
      expect(Array.isArray(data.items)).toBe(true)
    })

    it("accepts optional orderedAt and note", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: MOCK_SUPPLIER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            orderedAt: new Date().toISOString(),
            note: "Urgent order",
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 5, unitCost: 10.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it("returns 422 when supplierId is missing", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 10, unitCost: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when items array is empty", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: MOCK_SUPPLIER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when item quantity is zero", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: MOCK_SUPPLIER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [{ variantId: MOCK_VARIANT_ID, quantity: 0, unitCost: 5.0 }],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when supplierId is not a UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: "not-a-uuid",
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitCost: 10.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("GET /purchase-orders/:id", () => {
    it("returns a purchase order when it exists", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_PO_ID)
      expect(data.supplier).toBeDefined()
      expect(data.warehouse).toBeDefined()
      expect(Array.isArray(data.items)).toBe(true)
    })

    it("returns 404 when purchase order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${UNKNOWN_ID}`),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders/not-a-uuid"),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("PATCH /purchase-orders/:id", () => {
    it("updates a purchase order and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_PO_ID)
    })

    it("updates paymentStatus", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paymentStatus: "PAID" }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it("returns 400 for invalid status transition", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "SHIPPED" }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("Cannot transition")
    })

    it("returns 400 when completing without full receipt", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("not all items")
    })

    it("returns 422 when setting status to RECEIVED", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "RECEIVED" }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 404 when purchase order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${UNKNOWN_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid status value", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "INVALID_STATUS" }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders/not-a-uuid", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("POST /purchase-orders/:id/receive", () => {
    it("receives items and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}/receive`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ itemId: MOCK_ITEM_ID, receivedQty: 5 }],
          }),
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_PO_ID)
    })

    it("returns 404 when purchase order does not exist", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/purchase-orders/${UNKNOWN_ID}/receive`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              items: [{ itemId: MOCK_ITEM_ID, receivedQty: 5 }],
            }),
          },
        ),
      )

      expect(res.status).toBe(404)
    })

    it("returns 400 when order status does not allow receiving", async () => {
      mockService.receivePurchaseOrder.mockImplementationOnce(() =>
        Promise.resolve({ error: "Cannot receive items on a pending purchase order" }),
      )

      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}/receive`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ itemId: MOCK_ITEM_ID, receivedQty: 5 }],
          }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("Cannot receive")
    })

    it("returns 422 when items array is empty", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}/receive`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: [] }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when receivedQty is zero", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}/receive`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ itemId: MOCK_ITEM_ID, receivedQty: 0 }],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when itemId is not a UUID", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}/receive`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ itemId: "not-a-uuid", receivedQty: 5 }],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid order UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders/not-a-uuid/receive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: [{ itemId: MOCK_ITEM_ID, receivedQty: 3 }],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("DELETE /purchase-orders/:id", () => {
    it("deletes a purchase order and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe("Purchase order deleted")
    })

    it("returns 400 when order is not in PENDING status", async () => {
      mockService.deletePurchaseOrder.mockImplementationOnce(() =>
        Promise.resolve({ error: "Cannot delete a confirmed purchase order" }),
      )

      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${MOCK_PO_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("Cannot delete")
    })

    it("returns 404 when purchase order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/purchase-orders/${UNKNOWN_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/purchase-orders/not-a-uuid", {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
