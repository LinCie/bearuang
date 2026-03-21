import { describe, it, expect, mock, beforeAll } from "bun:test";
import { Elysia } from "elysia";

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_PRODUCT_ID = "b1dcf8a6-7e1a-4f5d-a3c2-8e7f1b2c3d4e";
const MOCK_VARIANT_ID = "c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f";
const UNKNOWN_ID = "e4f0b1d9-af4d-4c8a-a5e4-bf0a4e5f6071";

const mockVariant = {
  id: MOCK_VARIANT_ID,
  organizationId: MOCK_ORG_ID,
  productId: MOCK_PRODUCT_ID,
  sku: "SKU-001",
  name: "Test Variant",
  price: { toNumber: () => 9.99 },
  stock: 0,
  unit: "pcs",
  attributes: {},
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  product: { name: "Test Product" },
};

const mockService = {
  listVariantsByProduct: mock(() => Promise.resolve([mockVariant])),
  listVariants: mock(() => Promise.resolve({ data: [mockVariant], total: 1 })),
  getVariant: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_VARIANT_ID ? mockVariant : null),
  ),
  createVariant: mock(() => Promise.resolve(mockVariant)),
  updateVariant: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_VARIANT_ID ? 1 : 0 }),
  ),
  deleteVariant: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_VARIANT_ID ? 1 : 0 }),
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

mock.module("./variants.service", () => ({ variantsService: mockService }));

let app: any;

beforeAll(async () => {
  const { variantsRoute } = await import("./variants.route");
  app = new Elysia().use(variantsRoute);
});

describe("Variants", () => {
  describe("GET /products/:id/variants", () => {
    it("returns variants for a product", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}/variants`),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].id).toBe(MOCK_VARIANT_ID);
    });

    it("returns 422 for invalid product UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/products/not-a-uuid/variants"),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("POST /products/:id/variants", () => {
    it("creates a variant and returns 201", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}/variants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sku: "SKU-002",
            name: "New Variant",
            price: 19.99,
            unit: "pcs",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sku).toBe("SKU-001");
    });

    it("returns 422 when required fields are missing", async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}/variants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Missing SKU and price" }),
        }),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("GET /variants", () => {
    it("returns a list of all variants", async () => {
      const res = await app.handle(new Request("http://localhost/variants"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe(MOCK_VARIANT_ID);
    });

    it("accepts search query parameter", async () => {
      const res = await app.handle(
        new Request("http://localhost/variants?search=Test&take=10"),
      );

      expect(res.status).toBe(200);
    });
  });

  describe("GET /variants/:id", () => {
    it("returns a variant when it exists", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${MOCK_VARIANT_ID}`),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(MOCK_VARIANT_ID);
      expect(data.sku).toBe("SKU-001");
    });

    it("returns 404 when variant does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${UNKNOWN_ID}`),
      );

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid UUID", async () => {
      const res = await app.handle(
        new Request("http://localhost/variants/not-a-uuid"),
      );

      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /variants/:id", () => {
    it("updates a variant and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${MOCK_VARIANT_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated Variant", price: 24.99 }),
        }),
      );

      expect(res.status).toBe(200);
    });

    it("returns 404 when variant does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${UNKNOWN_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /variants/:id", () => {
    it("deletes a variant and returns 200", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${MOCK_VARIANT_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(200);
    });

    it("returns 404 when variant does not exist", async () => {
      const res = await app.handle(
        new Request(`http://localhost/variants/${UNKNOWN_ID}`, {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(404);
    });
  });
});
