import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

const MOCK_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MOCK_CUSTOMER_ID = 'd1ffb0aa-0d1c-4ef9-aa7e-7cc0ce491b22'
const UNKNOWN_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'

const mockCustomer = {
  id: MOCK_CUSTOMER_ID,
  organizationId: MOCK_ORG_ID,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-555-0200',
  address: '123 Main St',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockService = {
  listCustomers: mock(() =>
    Promise.resolve({ data: [mockCustomer], total: 1 }),
  ),
  getCustomer: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_CUSTOMER_ID ? mockCustomer : null),
  ),
  createCustomer: mock(() => Promise.resolve(mockCustomer)),
  updateCustomer: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_CUSTOMER_ID ? mockCustomer : null),
  ),
  deleteCustomer: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_CUSTOMER_ID ? mockCustomer : null),
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

mock.module('./customers.service', () => ({ customersService: mockService }))

let app: any

beforeAll(async () => {
  const { customersRoute } = await import('./customers.route')
  app = new Elysia().use(customersRoute)
})

describe('Customers', () => {
  describe('GET /customers', () => {
    it('returns a paginated list of customers', async () => {
      const res = await app.handle(new Request('http://localhost/customers'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_CUSTOMER_ID)
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(1)
    })

    it('accepts isActive filter', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers?isActive=true'),
      )

      expect(res.status).toBe(200)
    })

    it('accepts search parameter', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers?search=john'),
      )

      expect(res.status).toBe(200)
    })

    it('accepts sort params', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers?sortBy=name&sortOrder=asc'),
      )

      expect(res.status).toBe(200)
    })

    it('returns 422 for invalid sortBy value', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers?sortBy=invalidField'),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('POST /customers', () => {
    it('creates a customer and returns 201', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1-555-0200',
            address: '123 Main St',
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(MOCK_CUSTOMER_ID)
      expect(data.name).toBe('John Doe')
    })

    it('returns 422 when name is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'noname@example.com' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when email is invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Bad Email Person',
            email: 'not-an-email',
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when name is empty string', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('GET /customers/:id', () => {
    it('returns a customer when it exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${MOCK_CUSTOMER_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_CUSTOMER_ID)
      expect(data.name).toBe('John Doe')
    })

    it('returns 404 when customer does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${UNKNOWN_ID}`),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers/not-a-uuid'),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('PATCH /customers/:id', () => {
    it('updates a customer and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${MOCK_CUSTOMER_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Jane Doe' }),
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_CUSTOMER_ID)
    })

    it('returns 404 when customer does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${UNKNOWN_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Ghost Customer' }),
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid email', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${MOCK_CUSTOMER_ID}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'bad-email' }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers/not-a-uuid', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'X' }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('DELETE /customers/:id', () => {
    it('deletes a customer and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${MOCK_CUSTOMER_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe('Customer deleted')
    })

    it('returns 404 when customer does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/customers/${UNKNOWN_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/customers/not-a-uuid', {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
