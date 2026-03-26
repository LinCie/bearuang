import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─── Query Keys ──────────────────────────────────────────────

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: () => [...roleKeys.lists()] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  available: () => [...roleKeys.all, 'available'] as const,
}

// ─── Types ────────────────────────────────────────────────────
// Using simple string types to avoid template literal type issues from backend

export interface Role {
  id: string
  role: string
  permissions: string[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateRoleInput {
  role: string
  permissions: string[]
}

export interface UpdateRoleInput {
  role?: string
  permissions?: string[]
}

export interface AvailablePermissions {
  resources: string[]
  actions: Record<string, string[]>
  permissions: string[]
}

// ─── Queries ─────────────────────────────────────────────────

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.roles.get()
      if (error) throw error
      return data as Role[]
    },
  })
}

export function useRole(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.roles({ id }).get()
      if (error) throw error
      return data as Role
    },
    enabled: !!id,
  })
}

export function useAvailablePermissions() {
  return useQuery({
    queryKey: roleKeys.available(),
    queryFn: async () => {
      const { data, error } = await api.roles['available-permissions'].get()
      if (error) throw error
      return data as AvailablePermissions
    },
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateRoleInput) => {
      const { data, error } = await api.roles.post(input as any)
      if (error) throw error
      return data as Role
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRoleInput & { id: string }) => {
      const { data, error } = await api.roles({ id }).patch(input as any)
      if (error) throw error
      return data as Role
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.roles({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
    },
  })
}
