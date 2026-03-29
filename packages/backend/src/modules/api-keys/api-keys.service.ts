import { auth } from '@/integrations/auth'

/**
 * API Keys service — wraps better-auth's api-key plugin endpoints.
 *
 * All methods accept `headers` from the incoming request so that
 * better-auth can authenticate the caller.
 */
export const apiKeysService = {
  async createApiKey(
    userId: string,
    organizationId: string,
    data: {
      name: string
      permissions?: Record<string, string[]>
      expiresIn?: number
      rateLimitMax?: number
      rateLimitTimeWindow?: number
      metadata?: Record<string, unknown>
    },
  ) {
    const result = await auth.api.createApiKey({
      body: {
        configId: 'default',
        userId,
        organizationId,
        name: data.name,
        permissions: data.permissions,
        expiresIn: data.expiresIn,
        rateLimitMax: data.rateLimitMax,
        rateLimitTimeWindow: data.rateLimitTimeWindow,
        metadata: { ...data.metadata, userId },
      },
    })
    return result
  },

  async listApiKeys(headers: Headers, organizationId: string) {
    const result = await auth.api.listApiKeys({
      headers,
      query: { organizationId },
    })
    return result.apiKeys
  },

  async getApiKey(headers: Headers, organizationId: string, keyId: string) {
    const result = await auth.api.listApiKeys({
      headers,
      query: { organizationId },
    })
    return result.apiKeys.find((k) => k.id === keyId) ?? null
  },

  async updateApiKey(
    userId: string,
    keyId: string,
    data: {
      name?: string
      enabled?: boolean
      permissions?: Record<string, string[]>
      rateLimitMax?: number
      rateLimitTimeWindow?: number
      metadata?: Record<string, unknown> | null
    },
  ) {
    const result = await auth.api.updateApiKey({
      body: { keyId, userId, ...data },
    })
    return result
  },

  async deleteApiKey(headers: Headers, keyId: string) {
    const result = await auth.api.deleteApiKey({
      headers,
      body: { keyId },
    })
    return result
  },
}
