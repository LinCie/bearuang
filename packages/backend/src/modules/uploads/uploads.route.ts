import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { uploadsService } from './uploads.service'
import { errorResponse } from '@/common/error.response'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
} from '@/common/pagination'
import { getPublicUrl } from '@/integrations/s3'
import { MAX_FILE_SIZE } from '@/integrations/s3'

export const presignUploadDto = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
  purpose: z.string().optional(),
})

export const mediaSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  purpose: z.string().nullable(),
  url: z.string(),
  createdAt: z.iso.datetime(),
})

export type Media = z.infer<typeof mediaSchema>
export type PresignUploadInput = z.infer<typeof presignUploadDto>

const mediaIdParam = z.object({
  id: z.string().uuid(),
})

const listMediaQuery = paginationQuery.extend({
  purpose: z.string().optional(),
})

const serializeMedia = (m: {
  id: string
  organizationId: string
  key: string
  filename: string
  contentType: string
  size: number
  purpose: string | null
  createdAt: Date
}) => ({
  ...m,
  url: getPublicUrl(m.key),
  createdAt: m.createdAt.toISOString(),
})

const presignResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  uploadUrl: z.string(),
})

export const uploadsRoute = new Elysia({
  prefix: '/uploads',
  tags: ['Uploads'],
})
  .use(authPlugin)
  .post(
    '/presign',
    async ({ organization, body, status }) => {
      const { media, uploadUrl } = await uploadsService.presignUpload(
        organization.id,
        body,
      )
      return status(201, {
        id: media.id,
        key: media.key,
        uploadUrl,
      })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { media: ['create'] },
      body: presignUploadDto,
      response: {
        201: presignResponseSchema,
      },
      detail: {
        summary: 'Request presigned upload URL',
        description:
          'Returns a presigned PUT URL for direct upload to S3-compatible storage and creates a pending media record.',
      },
    },
  )
  .post(
    '/:id/confirm',
    async ({ organization, params, status }) => {
      const media = await uploadsService.confirmUpload(
        organization.id,
        params.id,
      )
      if (!media) return status(404, { message: 'Media not found' })
      return serializeMedia(media)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { media: ['create'] },
      params: mediaIdParam,
      response: {
        200: mediaSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Confirm upload',
        description:
          'Confirms that a file upload to S3 has been completed. Returns the full media record with public URL.',
      },
    },
  )
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, purpose } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await uploadsService.listMedia(organization.id, {
        skip,
        take,
        purpose,
      })
      return {
        data: data.map(serializeMedia),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { media: ['view'] },
      query: listMediaQuery,
      response: {
        200: paginatedResponse(mediaSchema),
      },
      detail: {
        summary: 'List media',
        description:
          'Retrieves a paginated list of media for the authenticated organization. Optionally filter by purpose.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const media = await uploadsService.getMedia(organization.id, params.id)
      if (!media) return status(404, { message: 'Media not found' })
      return serializeMedia(media)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { media: ['view'] },
      params: mediaIdParam,
      response: {
        200: mediaSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get media',
        description:
          'Retrieves a single media record by its ID with public URL.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ organization, params, status }) => {
      const deleted = await uploadsService.deleteMedia(
        organization.id,
        params.id,
      )
      if (!deleted) return status(404, { message: 'Media not found' })
      return status(200, { message: 'Media deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { media: ['delete'] },
      params: mediaIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete media',
        description:
          'Deletes a media record and its file from S3-compatible storage.',
      },
    },
  )
