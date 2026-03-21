import { describe, it, expect, mock, beforeAll } from "bun:test";
import { Elysia } from "elysia";

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_MOVEMENT_ID = "b1ffb0aa-0d1c-4ef9-aa7e-7cc0ce491b22";
const MOCK_WAREHOUSE_ID = "d3fea7b8-1c2d-4e5f-a6b7-8c9d0e1f2a3b";
const MOCK_VARIANT_ID = "e4afb8c9-2d3e-4f6a-b7c8-9d0e1f2a3b4c";
const UNKNOWN_ID = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f";

const mockMovement = {
  id: MOCK_MOVEMENT_ID,
  organizationId: MOCK_ORG_ID,
  warehouseId: MOCK_WAREHOUSE_ID,
  variantId: MOCK_VARIANT_ID,
  type: "IN",
  quantity: 10,
  referenceId: null,
  referenceType: null,
  note: "Initial stock",
  createdAt: new Date(),
  variant: { id: MOCK_VARIANT_ID, sku: "SKU-001", name: "Red T-Shirt S" },
  warehouse: { id: MOCK_WAREHOUSE_ID, name: "Main Warehouse" },
};

const mockService = {
  listMovements: mock(() => Promise.resolve({ data: [mockMovement], total: 1 })),
  getMovement: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_MOVEMENT_ID ? mockMovement : null),
  ),
  createMovement: mock(() => Promise.resolve(mockMovement)),
  deleteMovement: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_MOVEMENT_ID ? mockMovement : null),
  ),
};

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
}));

mock.module("./stock-movements.service", () => ({
  stockMovementService: mockService,
}));

let app: any;

beforeAll(async () => {
  const { stockMovementRoute } = await import("./stock-movements.route");
  app = new Elysia().use(stockMovementRoute);
});

describe("Stock Movements", () => {
  describe("GET /stock-movements", () => {
    it("returns a list of movements", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe(MOCK_MOVEMENT_ID);
    });

    it("accepts valid query filters", async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/stock-movements?type=IN&warehouseId=${MOCK_WAREHOUSE_ID}&variantId=${MOCK_VARIANT_ID}`,
        ),
      );

      expect(res.status).toBe(200);
    });

    it("returns 422 for invalid type query param", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements?type=INVALID"),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("GET /stock-movements/:id", () => {
    it("returns a movement when it exists", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock-movements/${MOCK_MOVEMENT_ID}`),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(MOCK_MOVEMENT_ID);
      expect(data.type).toBe("IN");
      expect(data.quantity).toBe(10);
    });

    it("returns 404 when movement does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock-movements/${UNKNOWN_ID}`),
      );

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements/not-a-uuid"),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("POST /stock-movements", () => {
    it("creates a movement and returns 201", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            variantId: MOCK_VARIANT_ID,
            type: "IN",
            quantity: 10,
            note: "Initial stock",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.type).toBe("IN");
      expect(data.quantity).toBe(10);
    });

    it("returns 422 when required fields are missing", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "IN" }),
        }),
      );

      expect(res.status).toBe(422);
    });

    it("returns 422 for quantity of zero", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            variantId: MOCK_VARIANT_ID,
            type: "OUT",
            quantity: 0,
          }),
        }),
      );

      expect(res.status).toBe(422);
    });

    it("returns 422 for invalid movement type", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            warehouseId: MOCK_WAREHOUSE_ID,
            variantId: MOCK_VARIANT_ID,
            type: "TRANSFER",
            quantity: 5,
          }),
        }),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("DELETE /stock-movements/:id", () => {
    it("deletes a movement and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock-movements/${MOCK_MOVEMENT_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(200);
    });

    it("returns 404 when movement does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/stock-movements/${UNKNOWN_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/stock-movements/not-a-uuid", {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(422);
    });
  });
});
