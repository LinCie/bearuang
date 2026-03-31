import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

const MOCK_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const MOCK_MEDIA_ID = 'b1ffb0aa-0d1c-4ef9-aa7e-7cc0ce491b22'
const UNKNOWN_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'

const mockMedia = {
  id: MOCK_MEDIA_ID,
  organizationId: MOCK_ORG_ID,
  key: `${MOCK_ORG_ID}/uploads/test-file.png`,
  filename: 'test-file.png',
  contentType: 'image/png',
  size: 1024,
  purpose: null,
  createdAt: new Date(),
}

const mockService = {
  presignUpload: mock(() =>
    Promise.resolve({
      media: mockMedia,
      uploadUrl: 'https://s3.example.com/presigned-put-url',
    }),
  ),
  confirmUpload: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_MEDIA_ID ? mockMedia : null),
  ),
  listMedia: mock(() => Promise.resolve({ data: [mockMedia], total: 1 })),
  getMedia: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_MEDIA_ID ? mockMedia : null),
  ),
  deleteMedia: mock((orgId: string, id: string) =>
    Promise.resolve(id === MOCK_MEDIA_ID ? mockMedia : null),
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

mock.module('#integrations/s3', () => ({
  presignPut: mock(() =>
    Promise.resolve({ url: 'https://s3.example.com/presigned-put-url' }),
  ),
  deleteObject: mock(() => Promise.resolve()),
  getPublicUrl: mock((key: string) => `https://s3.example.com/${key}`),
  MAX_FILE_SIZE: 50 * 1024 * 1024,
}))

mock.module('./uploads.service', () => ({
  uploadsService: mockService,
}))

let app: any

beforeAll(async () => {
  const { uploadsRoute } = await import('./uploads.route')
  app = new Elysia().use(uploadsRoute)
})

describe('Uploads', () => {
  describe('POST /uploads/presign', () => {
    it('returns a presigned URL and media ID with 201', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: 'test-file.png',
            contentType: 'image/png',
            size: 1024,
          }),
        }),
      )

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe(MOCK_MEDIA_ID)
      expect(data.key).toBe(mockMedia.key)
      expect(data.uploadUrl).toBe('https://s3.example.com/presigned-put-url')
    })

    it('accepts optional purpose field', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: 'avatar.jpg',
            contentType: 'image/jpeg',
            size: 2048,
            purpose: 'avatar',
          }),
        }),
      )

      expect(res.status).toBe(201)
    })

    it('returns 422 when filename is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contentType: 'image/png',
            size: 1024,
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when size exceeds 50MB', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: 'huge.bin',
            contentType: 'application/octet-stream',
            size: 60 * 1024 * 1024,
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when size is zero', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: 'empty.txt',
            contentType: 'text/plain',
            size: 0,
          }),
        }),
      )

      expect(res.status).toBe(422)
    })

    it('returns 422 when contentType is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: 'test.png',
            size: 1024,
          }),
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('POST /uploads/:id/confirm', () => {
    it('confirms an upload and returns media with URL', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${MOCK_MEDIA_ID}/confirm`, {
          method: 'POST',
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_MEDIA_ID)
      expect(data.url).toContain(MOCK_ORG_ID)
    })

    it('returns 404 for unknown media ID', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${UNKNOWN_ID}/confirm`, {
          method: 'POST',
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/not-a-uuid/confirm', {
          method: 'POST',
        }),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('GET /uploads', () => {
    it('returns a paginated list of media', async () => {
      const res = await app.handle(new Request('http://localhost/uploads'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data[0].id).toBe(MOCK_MEDIA_ID)
      expect(body.data[0].url).toBeDefined()
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(1)
    })

    it('accepts purpose filter', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads?purpose=avatar'),
      )

      expect(res.status).toBe(200)
    })
  })

  describe('GET /uploads/:id', () => {
    it('returns a media record when it exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${MOCK_MEDIA_ID}`),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe(MOCK_MEDIA_ID)
      expect(data.url).toBeDefined()
    })

    it('returns 404 when media does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${UNKNOWN_ID}`),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/not-a-uuid'),
      )

      expect(res.status).toBe(422)
    })
  })

  describe('DELETE /uploads/:id', () => {
    it('deletes a media record and returns 200', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${MOCK_MEDIA_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.message).toBe('Media deleted')
    })

    it('returns 404 when media does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/uploads/${UNKNOWN_ID}`, {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 for invalid UUID', async () => {
      const res = await app.handle(
        new Request('http://localhost/uploads/not-a-uuid', {
          method: 'DELETE',
        }),
      )

      expect(res.status).toBe(422)
    })
  })
})
