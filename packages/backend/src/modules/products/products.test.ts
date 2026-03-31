import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

const MOCK_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MOCK_PRODUCT_ID = 'b1dcf8a6-7e1a-4f5d-a3c2-8e7f1b2c3d4e'

const mockProduct = {
  id: MOCK_PRODUCT_ID,
  organizationId: MOCK_ORG_ID,
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product',
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: [],
}

const mockService = {
  listProducts: mock(() => Promise.resolve({ data: [mockProduct], total: 1 })),
  getProduct: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_PRODUCT_ID ? mockProduct : null),
  ),
  createProduct: mock(() => Promise.resolve(mockProduct)),
  updateProduct: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_PRODUCT_ID ? 1 : 0 }),
  ),
  deleteProduct: mock(() => Promise.resolve()),
}

mock.module('#plugins/auth.plugin', () => ({
  authPlugin: new Elysia({ name: 'auth' }).macro({
    requireAuth: {
      resolve: () => ({
        user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
        session: { id: 'session-1' },
      }),
    },
    requireOrg: {
      resolve: () => ({
        organization: { id: MOCK_ORG_ID, name: 'Test Org' },
      }),
    },
  }),
}))

mock.module('./products.service', () => ({ productsService: mockService }))

let app: any

beforeAll(async () => {
  const { productsRoute } = await import('./products.route')
  app = new Elysia().use(productsRoute)
})

describe('Products', () => {
  describe('GET /products', () => {
    it('returns a list of products', async () => {
      const res = await app.handle(new Request('http://localhost/products'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_PRODUCT_ID)
    })
  })

  describe('GET /products/:id', () => {
    it('returns a product when it exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_PRODUCT_ID)
      expect(data.name).toBe('Test Product')
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/products/not-a-uuid'),
      )

      expect(res.status).toBe(422)
    })

    it('returns 404 when product does not exist', async () => {
      const unknownId = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'
      const res = await app.handle(
        new Request(`http://localhost/products/${unknownId}`),
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /products', () => {
    it('creates a product and returns 201', async () => {
      const res = await app.handle(
        new Request('http://localhost/products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'New Product',
            slug: 'new-product',
            description: 'Desc',
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.name).toBe('Test Product')
    })

    it('returns 422 when name is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: 'test-slug', description: 'No name' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when slug is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test', description: 'No slug' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('PATCH /products/:id', () => {
    it('updates a product and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it('returns 404 when product does not exist', async () => {
      const unknownId = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'
      const res = await app.handle(
        new Request(`http://localhost/products/${unknownId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      )

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /products/:id', () => {
    it('deletes a product and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/products/${MOCK_PRODUCT_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(200)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/products/not-a-uuid', {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
