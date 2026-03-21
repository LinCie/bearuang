import { describe, it, expect, mock, beforeAll } from "bun:test"
import { Elysia } from "elysia"

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const MOCK_WAREHOUSE_ID = "d3fea7b8-1c2d-4e5f-a6b7-8c9d0e1f2a3b"

const mockWarehouse = {
  id: MOCK_WAREHOUSE_ID,
  organizationId: MOCK_ORG_ID,
  name: "Main Warehouse",
  address: "123 Storage St",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockService = {
  listWarehouses: mock(() => Promise.resolve({ data: [mockWarehouse], total: 1 })),
  getWarehouse: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_WAREHOUSE_ID ? mockWarehouse : null),
  ),
  createWarehouse: mock(() => Promise.resolve(mockWarehouse)),
  updateWarehouse: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_WAREHOUSE_ID ? 1 : 0 }),
  ),
  deleteWarehouse: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_WAREHOUSE_ID ? 1 : 0 }),
  ),
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

mock.module("./warehouses.service", () => ({ warehousesService: mockService }))

let app: any

beforeAll(async () => {
  const { warehousesRoute } = await import("./warehouses.route")
  app = new Elysia().use(warehousesRoute)
})

describe("Warehouses", () => {
  describe("GET /warehouses", () => {
    it("returns a list of warehouses", async () => {
      const res = await app.handle(new Request("http://localhost/warehouses"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_WAREHOUSE_ID)
    })
  })

  describe("GET /warehouses/:id", () => {
    it("returns a warehouse when it exists", async () => {
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${MOCK_WAREHOUSE_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_WAREHOUSE_ID)
      expect(data.name).toBe("Main Warehouse")
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/warehouses/not-a-uuid"),
      )

      expect(res.status).toBe(422)
    })

    it("returns 404 when warehouse does not exist", async () => {
      const unknownId = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f"
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${unknownId}`),
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /warehouses", () => {
    it("creates a warehouse and returns 201", async () => {
      const res = await app.handle(
        new Request("http://localhost/warehouses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "New Warehouse", address: "456 Depot Rd" }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.name).toBe("Main Warehouse")
    })

    it("returns 422 when name is missing", async () => {
      const res = await app.handle(
        new Request("http://localhost/warehouses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: "No name provided" }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe("PATCH /warehouses/:id", () => {
    it("updates a warehouse and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${MOCK_WAREHOUSE_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated Warehouse" }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it("returns 404 when warehouse does not exist", async () => {
      const unknownId = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f"
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${unknownId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated Warehouse" }),
        }),
      )

      expect(res.status).toBe(404)
    })
  })

  describe("DELETE /warehouses/:id", () => {
    it("deletes a warehouse and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${MOCK_WAREHOUSE_ID}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(200)
    })

    it("returns 404 when warehouse does not exist", async () => {
      const unknownId = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f"
      const res = await app.handle(
        new Request(`http://localhost/warehouses/${unknownId}`, {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/warehouses/not-a-uuid", {
          method: "DELETE",
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
