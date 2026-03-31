import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { apiKeysService } from './api-keys.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'

const apiKeySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable(),
  prefix: z.string().nullable(),
  enabled: z.boolean().nullable(),
  permissions: z.record(z.string(), z.array(z.string())).nullable(),
  rateLimitMax: z.number().nullable(),
  rateLimitTimeWindow: z.number().nullable(),
  remaining: z.number().nullable(),
  lastRequest: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})

const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string(),
})

const createApiKeyDto = z.object({
  name: z.string().min(1).max(64),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  expiresIn: z.number().positive().optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const updateApiKeyDto = z.object({
  name: z.string().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const apiKeyIdParam = z.object({
  id: z.string(),
})

type ApiKey = Record<string, unknown>

const serialize = (key: ApiKey) => ({
  id: key.id as string,
  name: (key.name as string | null) ?? null,
  start: (key.start as string | null) ?? null,
  prefix: (key.prefix as string | null) ?? null,
  enabled: (key.enabled as boolean | null) ?? true,
  permissions: (key.permissions as Record<string, string[]> | null) ?? null,
  rateLimitMax: (key.rateLimitMax as number | null) ?? null,
  rateLimitTimeWindow: (key.rateLimitTimeWindow as number | null) ?? null,
  remaining: (key.remaining as number | null) ?? null,
  lastRequest: key.lastRequest
    ? new Date(key.lastRequest as string | number).toISOString()
    : null,
  expiresAt: key.expiresAt
    ? new Date(key.expiresAt as string | number).toISOString()
    : null,
  createdAt: new Date(key.createdAt as string | number).toISOString(),
  updatedAt: new Date(key.updatedAt as string | number).toISOString(),
  metadata: (key.metadata as Record<string, unknown> | null) ?? null,
})

const serializeWithSecret = (key: ApiKey) => ({
  ...serialize(key),
  key: key.key as string,
})

export const apiKeysRoute = new Elysia({
  prefix: '/api-keys',
  tags: ['API Keys'],
})
  .use(authPlugin)
  .post(
    '/',
    async ({ _authType, user, organization, body }) => {
      const key = await apiKeysService.createApiKey(
        user.id,
        organization.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ApiKey',
        operation: 'create',
        args: { data: body },
      })
      return serializeWithSecret(key as unknown as ApiKey)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { apiKey: ['create'] },
      body: createApiKeyDto,
      response: {
        200: apiKeyWithSecretSchema,
      },
      detail: {
        summary: 'Create an API key',
        description:
          'Creates a new API key for the authenticated organization with scoped permissions.',
      },
    },
  )
  .get(
    '/',
    async ({ organization, request }) => {
      const keys = await apiKeysService.listApiKeys(
        request.headers,
        organization.id,
      )
      return (keys as unknown as ApiKey[]).map(serialize)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { apiKey: ['read'] },
      response: {
        200: z.array(apiKeySchema),
      },
      detail: {
        summary: 'List API keys',
        description:
          'Retrieves all API keys belonging to the authenticated organization.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status, request }) => {
      const key = await apiKeysService.getApiKey(
        request.headers,
        organization.id,
        params.id,
      )
      if (!key) return status(404, { message: 'API key not found' })
      return serialize(key as unknown as ApiKey)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { apiKey: ['read'] },
      params: apiKeyIdParam,
      response: {
        200: apiKeySchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get an API key',
        description: 'Retrieves the details of a specific API key by its ID.',
      },
    },
  )
  .patch(
    '/:id',
    async ({
      _authType,
      user,
      organization,
      params,
      body,
      status,
      request,
    }) => {
      const existing = await apiKeysService.getApiKey(
        request.headers,
        organization.id,
        params.id,
      )
      if (!existing) return status(404, { message: 'API key not found' })
      const updated = await apiKeysService.updateApiKey(
        user.id,
        params.id,
        body,
      )
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ApiKey',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return serialize(updated as unknown as ApiKey)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { apiKey: ['update'] },
      params: apiKeyIdParam,
      body: updateApiKeyDto,
      response: {
        200: apiKeySchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Update an API key',
        description:
          'Updates the details of an existing API key (name, enabled, permissions, rate limit).',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, user, organization, params, status, request }) => {
      const existing = await apiKeysService.getApiKey(
        request.headers,
        organization.id,
        params.id,
      )
      if (!existing) return status(404, { message: 'API key not found' })
      await apiKeysService.deleteApiKey(request.headers, params.id)
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'ApiKey',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'API key deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { apiKey: ['delete'] },
      params: apiKeyIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete an API key',
        description: 'Revokes and deletes an API key by its ID.',
      },
    },
  )
