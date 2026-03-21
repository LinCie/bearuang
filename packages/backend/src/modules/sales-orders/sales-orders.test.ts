import { describe, it, expect, mock, beforeAll } from "bun:test"
import { Elysia } from "elysia"

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const MOCK_SO_ID = "b1ffb0aa-0d1c-4ef8-bb7e-7cc0ce491b22"
const MOCK_CUSTOMER_ID = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f"
const MOCK_WAREHOUSE_ID = "d3fee8c8-9a3c-4fb7-ae4e-af9f3d4e5f60"
const MOCK_VARIANT_ID = "e4aff9d9-ab4d-4c8a-b6f5-ba0a4e5f6a71"
const MOCK_ITEM_ID = "f5baa0ea-bc5e-4d9b-a7a6-cb1b5f6a7b82"
const UNKNOWN_ID = "99999999-9999-4999-a999-999999999999"

const mockItem = {
  id: MOCK_ITEM_ID,
  salesOrderId: MOCK_SO_ID,
  variantId: MOCK_VARIANT_ID,
  variant: { id: MOCK_VARIANT_ID, sku: "SKU-001", name: "Widget Blue" },
  quantity: 2,
  unitPrice: { toString: () => "25.00" },
}

const mockSalesOrder = {
  id: MOCK_SO_ID,
  organizationId: MOCK_ORG_ID,
  customerId: MOCK_CUSTOMER_ID,
  customer: { id: MOCK_CUSTOMER_ID, name: "John Doe" },
  warehouseId: MOCK_WAREHOUSE_ID,
  warehouse: { id: MOCK_WAREHOUSE_ID, name: "Main Warehouse" },
  guestName: null,
  guestEmail: null,
  shippingAddress: {},
  status: "PENDING" as const,
  paymentStatus: "UNPAID" as const,
  orderedAt: null,
  shippedAt: null,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockItem],
}

const mockSalesOrderGuest = {
  ...mockSalesOrder,
  customerId: null,
  customer: null,
  guestName: "Jane Guest",
  guestEmail: "jane@example.com",
}

const mockService = {
  listSalesOrders: mock(() =>
    Promise.resolve({ data: [mockSalesOrder], total: 1 }),
  ),
  getSalesOrder: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_SO_ID ? mockSalesOrder : null),
  ),
  createSalesOrder: mock((orgId: string, data: any) => {
    if (data.warehouseId === UNKNOWN_ID) {
      return Promise.resolve({ error: "Warehouse not found" })
    }
    if (data.items?.some((i: any) => i.variantId === UNKNOWN_ID)) {
      return Promise.resolve({ error: "One or more product variants not found" })
    }
    if (!data.customerId && !data.guestName) {
      return Promise.resolve({ error: "Either customerId or guestName must be provided" })
    }
    if (data.customerId) {
      return Promise.resolve(mockSalesOrder)
    }
    return Promise.resolve(mockSalesOrderGuest)
  }),
  updateSalesOrder: mock((orgId: string, id: string, data: any) => {
    if (id !== MOCK_SO_ID) return Promise.resolve({ error: "not_found" })
    return Promise.resolve({ ...mockSalesOrder, ...data })
  }),
  deleteSalesOrder: mock((orgId: string, id: string) => {
    if (id !== MOCK_SO_ID) return Promise.resolve({ error: "not_found" })
    return Promise.resolve(mockSalesOrder)
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

mock.module("./sales-orders.service", () => ({
  salesOrdersService: mockService,
}))

let app: any

beforeAll(async () => {
  const { salesOrdersRoute } = await import("./sales-orders.route")
  app = new Elysia().use(salesOrdersRoute)
})

describe("Sales Orders", () => {
  describe("GET /sales-orders", () => {
    it("returns a paginated list of sales orders", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders"),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_SO_ID)
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(1)
    })

    it("accepts status filter", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?status=PENDING"),
      )

      expect(res.status).toBe(200)
    })

    it("accepts paymentStatus filter", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?paymentStatus=UNPAID"),
      )

      expect(res.status).toBe(200)
    })

    it("accepts customerId filter", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/sales-orders?customerId=${MOCK_CUSTOMER_ID}`,
        ),
      )

      expect(res.status).toBe(200)
    })

    it("accepts search filter", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?search=test"),
      )

      expect(res.status).toBe(200)
    })

    it("accepts sort params", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/sales-orders?sortBy=createdAt&sortOrder=asc",
        ),
      )

      expect(res.status).toBe(200)
    })

    it("returns 422 for invalid status value", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?status=INVALID"),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid paymentStatus value", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?paymentStatus=INVALID"),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid sortBy value", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders?sortBy=invalidField"),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("POST /sales-orders", () => {
    it("creates a sales order with customerId and returns 201", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 2, unitPrice: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SO_ID)
      expect(data.customerId).toBe(MOCK_CUSTOMER_ID)
      expect(data.warehouseId).toBe(MOCK_WAREHOUSE_ID)
      expect(Array.isArray(data.items)).toBe(true)
    })

    it("creates a sales order with guest info and returns 201", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            guestName: "Jane Guest",
            guestEmail: "jane@example.com",
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitPrice: 10.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it("accepts optional orderedAt, note, and shippingAddress", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            orderedAt: new Date().toISOString(),
            note: "Express shipping",
            shippingAddress: { street: "123 Main St", city: "Jakarta" },
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 5, unitPrice: 10.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it("returns 400 when neither customerId nor guestName is provided", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitPrice: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("customerId or guestName")
    })

    it("returns 400 when warehouse not found", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: UNKNOWN_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitPrice: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("Warehouse not found")
    })

    it("returns 400 when variant not found", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: UNKNOWN_ID, quantity: 1, unitPrice: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("variants not found")
    })

    it("returns 422 when warehouseId is missing", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitPrice: 25.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when items array is empty", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when item quantity is zero", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: MOCK_CUSTOMER_ID,
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [{ variantId: MOCK_VARIANT_ID, quantity: 0, unitPrice: 5.0 }],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 when customerId is not a UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: "not-a-uuid",
            warehouseId: MOCK_WAREHOUSE_ID,
            items: [
              { variantId: MOCK_VARIANT_ID, quantity: 1, unitPrice: 10.0 },
            ],
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("GET /sales-orders/:id", () => {
    it("returns a sales order when it exists", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SO_ID)
      expect(data.customer).toBeDefined()
      expect(data.warehouse).toBeDefined()
      expect(Array.isArray(data.items)).toBe(true)
    })

    it("returns 404 when sales order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${UNKNOWN_ID}`),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders/not-a-uuid"),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("PATCH /sales-orders/:id", () => {
    it("updates a sales order and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SO_ID)
    })

    it("updates paymentStatus", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paymentStatus: "PAID" }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it("updates shippingAddress", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shippingAddress: { street: "456 Oak Ave", city: "Bandung" },
          }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it("returns 404 when sales order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${UNKNOWN_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid status value", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "INVALID_STATUS" }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders/not-a-uuid", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("DELETE /sales-orders/:id", () => {
    it("deletes a sales order and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe("Sales order deleted")
    })

    it("returns 400 when order is not deletable", async () => {
      mockService.deleteSalesOrder.mockImplementationOnce(() =>
        Promise.resolve({ error: "Cannot delete a confirmed sales order" }),
      )

      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${MOCK_SO_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain("Cannot delete")
    })

    it("returns 404 when sales order does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/sales-orders/${UNKNOWN_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/sales-orders/not-a-uuid", {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
