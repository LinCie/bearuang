import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

const MOCK_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MOCK_CATEGORY_ID = 'b1dcf8a6-7e1a-4f5d-a3c2-8e7f1b2c3d4e'
const MOCK_PARENT_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'

const mockCategory = {
  id: MOCK_CATEGORY_ID,
  organizationId: MOCK_ORG_ID,
  parentId: null,
  parent: null,
  children: [],
  name: 'Test Category',
  slug: 'test-category',
  description: 'A test category',
  sortOrder: 0,
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { products: 3 },
}

const mockTrashedCategory = {
  id: MOCK_CATEGORY_ID,
  organizationId: MOCK_ORG_ID,
  parentId: null,
  parent: null,
  name: 'Deleted Category',
  slug: 'deleted-category',
  description: null,
  sortOrder: 0,
  isActive: false,
  deletedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockService = {
  listProductCategories: mock(() =>
    Promise.resolve({ data: [mockCategory], total: 1 }),
  ),
  listTrashedProductCategories: mock(() =>
    Promise.resolve({ data: [mockTrashedCategory], total: 1 }),
  ),
  getProductCategory: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_CATEGORY_ID ? mockCategory : null),
  ),
  createProductCategory: mock(() => Promise.resolve(mockCategory)),
  updateProductCategory: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_CATEGORY_ID ? 1 : 0 }),
  ),
  deleteProductCategory: mock(() => Promise.resolve()),
  restoreProductCategory: mock((orgId: string, id: string) =>
    Promise.resolve({ count: id === MOCK_CATEGORY_ID ? 1 : 0 }),
  ),
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

mock.module('./product-categories.service', () => ({
  productCategoriesService: mockService,
}))

let app: any

beforeAll(async () => {
  const { productCategoriesRoute } = await import('./product-categories.route')
  app = new Elysia().use(productCategoriesRoute)
})

describe('Product Categories', () => {
  describe('GET /product-categories', () => {
    it('returns a list of categories', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories'),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_CATEGORY_ID)
      expect(body.meta).toBeDefined()
      expect(typeof body.meta.total).toBe('number')
    })
  })

  describe('GET /product-categories/:id', () => {
    it('returns a category when it exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/product-categories/${MOCK_CATEGORY_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_CATEGORY_ID)
      expect(data.name).toBe('Test Category')
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories/not-a-uuid'),
      )

      expect(res.status).toBe(422)
    })

    it('returns 404 when category does not exist', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000'
      const res = await app.handle(
        new Request(`http://localhost/product-categories/${unknownId}`),
      )

      expect(res.status).toBe(404)
    })
  })

  describe('POST /product-categories', () => {
    it('creates a category and returns 201', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'New Category',
            slug: 'new-category',
            description: 'Desc',
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.name).toBe('Test Category')
    })

    it('creates a child category with parentId', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Child Category',
            slug: 'child-category',
            parentId: MOCK_PARENT_ID,
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it('creates a root category with parentId null', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Root Category',
            slug: 'root-category',
            parentId: null,
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it('returns 422 when name is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: 'test-slug' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when slug is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 for invalid slug format', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test', slug: 'Invalid Slug!' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 for invalid parentId UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Test',
            slug: 'test',
            parentId: 'not-a-uuid',
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('PATCH /product-categories/:id', () => {
    it('updates a category and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/product-categories/${MOCK_CATEGORY_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      )

      expect(res.status).toBe(200)
    })

    it('returns 404 when category does not exist', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000'
      const res = await app.handle(
        new Request(`http://localhost/product-categories/${unknownId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories/not-a-uuid', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('DELETE /product-categories/:id', () => {
    it('deletes a category and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/product-categories/${MOCK_CATEGORY_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(200)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories/not-a-uuid', {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('GET /product-categories/trashed', () => {
    it('returns a list of trashed categories', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories/trashed'),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.meta).toBeDefined()
    })
  })

  describe('POST /product-categories/:id/restore', () => {
    it('restores a trashed category and returns 200', async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/product-categories/${MOCK_CATEGORY_ID}/restore`,
          { method: 'POST' },
        ),
      )

      expect(res.status).toBe(200)
    })

    it('returns 404 when category does not exist', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000'
      const res = await app.handle(
        new Request(
          `http://localhost/product-categories/${unknownId}/restore`,
          { method: 'POST' },
        ),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/product-categories/not-a-uuid/restore', {
          method: 'POST',
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
