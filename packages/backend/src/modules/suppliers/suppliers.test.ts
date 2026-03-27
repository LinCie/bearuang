import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

const MOCK_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MOCK_SUPPLIER_ID = 'b1ffb0aa-0d1c-4ef9-aa7e-7cc0ce491b22'
const UNKNOWN_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'

const mockSupplier = {
  id: MOCK_SUPPLIER_ID,
  organizationId: MOCK_ORG_ID,
  name: 'Acme Corp',
  email: 'acme@example.com',
  phone: '+1-555-0100',
  address: '1 Acme Way',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockService = {
  listSuppliers: mock(() =>
    Promise.resolve({ data: [mockSupplier], total: 1 }),
  ),
  getSupplier: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_SUPPLIER_ID ? mockSupplier : null),
  ),
  createSupplier: mock(() => Promise.resolve(mockSupplier)),
  updateSupplier: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_SUPPLIER_ID ? mockSupplier : null),
  ),
  deleteSupplier: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_SUPPLIER_ID ? mockSupplier : null),
  ),
}

mock.module('@/plugins/auth.plugin', () => ({
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

mock.module('./suppliers.service', () => ({ suppliersService: mockService }))

let app: any

beforeAll(async () => {
  const { suppliersRoute } = await import('./suppliers.route')
  app = new Elysia().use(suppliersRoute)
})

describe('Suppliers', () => {
  describe('GET /suppliers', () => {
    it('returns a paginated list of suppliers', async () => {
      const res = await app.handle(new Request('http://localhost/suppliers'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_SUPPLIER_ID)
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(1)
    })

    it('accepts isActive filter', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers?isActive=true'),
      )

      expect(res.status).toBe(200)
    })

    it('accepts sort params', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers?sortBy=name&sortOrder=asc'),
      )

      expect(res.status).toBe(200)
    })

    it('returns 422 for invalid sortBy value', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers?sortBy=invalidField'),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('POST /suppliers', () => {
    it('creates a supplier and returns 201', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Acme Corp',
            email: 'acme@example.com',
            phone: '+1-555-0100',
            address: '1 Acme Way',
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SUPPLIER_ID)
      expect(data.name).toBe('Acme Corp')
    })

    it('returns 422 when name is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'noname@example.com' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when email is invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Bad Email Co', email: 'not-an-email' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when name is empty string', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('GET /suppliers/:id', () => {
    it('returns a supplier when it exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${MOCK_SUPPLIER_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SUPPLIER_ID)
      expect(data.name).toBe('Acme Corp')
    })

    it('returns 404 when supplier does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${UNKNOWN_ID}`),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers/not-a-uuid'),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('PATCH /suppliers/:id', () => {
    it('updates a supplier and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${MOCK_SUPPLIER_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Corp' }),
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_SUPPLIER_ID)
    })

    it('returns 404 when supplier does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${UNKNOWN_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Ghost Supplier' }),
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid email', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${MOCK_SUPPLIER_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'bad-email' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers/not-a-uuid', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'X' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('DELETE /suppliers/:id', () => {
    it('deletes a supplier and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${MOCK_SUPPLIER_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe('Supplier deleted')
    })

    it('returns 404 when supplier does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/suppliers/${UNKNOWN_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/suppliers/not-a-uuid', {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
