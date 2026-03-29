import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'

// ─── Types ────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean | null
  permissions: Record<string, string[]> | null
  rateLimitMax: number | null
  rateLimitTimeWindow: number | null
  remaining: number | null
  lastRequest: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown> | null
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string
}

export interface CreateApiKeyInput {
  name: string
  permissions?: Record<string, string[]>
  expiresIn?: number
  rateLimitMax?: number
  rateLimitTimeWindow?: number
  metadata?: Record<string, unknown>
}

export interface UpdateApiKeyInput {
  name?: string
  enabled?: boolean
  permissions?: Record<string, string[]>
  rateLimitMax?: number
  rateLimitTimeWindow?: number
  metadata?: Record<string, unknown> | null
}

// ─── Query Keys ──────────────────────────────────────────────

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: () => [...apiKeyKeys.lists()] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (id: string) => [...apiKeyKeys.details(), id] as const,
}

// ─── Queries ─────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: async () => {
      const { data, error } = await api['api-keys'].get()
      if (error) throw error
      return data
    },
  })
}

export function useApiKey(id: string) {
  return useQuery({
    queryKey: apiKeyKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['api-keys']({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const { data, error } = await api['api-keys'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateApiKeyInput & { id: string }) => {
      const { data, error } = await api['api-keys']({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: apiKeyKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['api-keys']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
