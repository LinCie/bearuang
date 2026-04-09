import { auth } from '#integrations/auth'

/**
 * API Keys service — wraps better-auth's api-key plugin endpoints.
 *
 * All methods accept `headers` from the incoming request so that
 * better-auth can authenticate the caller.
 */
export const apiKeysService = {
  /**
   * Creates a new API key for a user within an organization.
   * @param userId - User identifier.
   * @param organizationId - Organization identifier.
   * @param data - API key creation data including name, permissions, expiry, and rate limits.
   * @returns The created API key record.
   * @usage Used in api-keys.route.ts (POST /api-keys)
   * @sideEffects Creates a new record in the apiKeys table.
   */
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

  /**
   * Lists all API keys for an organization.
   * @param headers - Request headers for authentication.
   * @param organizationId - Organization identifier.
   * @returns The list of API keys for the organization.
   * @usage Used in api-keys.route.ts (GET /api-keys)
   * @sideEffects None (Read-only)
   */
  async listApiKeys(headers: Headers, organizationId: string) {
    const result = await auth.api.listApiKeys({
      headers,
      query: { organizationId },
    })
    return result.apiKeys
  },

  /**
   * Retrieves a single API key by ID.
   * @param headers - Request headers for authentication.
   * @param organizationId - Organization identifier.
   * @param keyId - API key identifier.
   * @returns The API key record or null if not found.
   * @usage Used in api-keys.route.ts (GET /api-keys/:id), (PATCH /api-keys/:id), (DELETE /api-keys/:id)
   * @sideEffects None (Read-only)
   */
  async getApiKey(headers: Headers, organizationId: string, keyId: string) {
    const result = await auth.api.listApiKeys({
      headers,
      query: { organizationId },
    })
    return result.apiKeys.find((k) => k.id === keyId) ?? null
  },

  /**
   * Updates an existing API key.
   * @param userId - User identifier (key owner).
   * @param keyId - API key identifier.
   * @param data - API key update data including name, enabled status, permissions, and rate limits.
   * @returns The updated API key record.
   * @usage Used in api-keys.route.ts (PATCH /api-keys/:id)
   * @sideEffects Updates an existing record in the apiKeys table.
   */
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

  /**
   * Deletes an API key.
   * @param headers - Request headers for authentication.
   * @param keyId - API key identifier.
   * @returns The deletion result.
   * @usage Used in api-keys.route.ts (DELETE /api-keys/:id)
   * @sideEffects Deletes a record from the apiKeys table.
   */
  async deleteApiKey(headers: Headers, keyId: string) {
    const result = await auth.api.deleteApiKey({
      headers,
      body: { keyId },
    })
    return result
  },
}
