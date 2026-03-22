import { auth } from "@/integrations/auth";

export const apiKeysService = {
  async createApiKey(
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
        configId: "default",
        organizationId,
        name: data.name,
        permissions: data.permissions,
        expiresIn: data.expiresIn,
        rateLimitMax: data.rateLimitMax,
        rateLimitTimeWindow: data.rateLimitTimeWindow,
        metadata: data.metadata,
      },
    });
    return result;
  },

  async listApiKeys(organizationId: string) {
    const result = await auth.api.listApiKeys({
      query: { organizationId },
    });
    return result.apiKeys;
  },

  async getApiKey(organizationId: string, keyId: string) {
    const result = await auth.api.listApiKeys({
      query: { organizationId },
    });
    return result.apiKeys.find((k) => k.id === keyId) ?? null;
  },

  async updateApiKey(
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
      body: { keyId, ...data },
    });
    return result;
  },

  async deleteApiKey(keyId: string) {
    const result = await auth.api.deleteApiKey({
      body: { keyId },
    });
    return result;
  },
};
