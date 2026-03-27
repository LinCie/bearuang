import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
  Customer,
} from 'backend/src/modules/customers/customers.route'

// ─── Query Keys ──────────────────────────────────────────────

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: ListCustomersQuery) =>
    [...customerKeys.lists(), params] as const,
  trashed: () => [...customerKeys.all, 'trashed'] as const,
  trashedList: (params: ListCustomersQuery) =>
    [...customerKeys.trashed(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateCustomerInput,
  ListCustomersQuery,
  Customer,
  UpdateCustomerInput,
}

// ─── Queries ─────────────────────────────────────────────────

export function useCustomers(params: Partial<ListCustomersQuery> = {}) {
  return useQuery({
    queryKey: customerKeys.list(params as ListCustomersQuery),
    queryFn: async () => {
      const { data, error } = await api.customers.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
          isActive: params.isActive,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useTrashedCustomers(params: Partial<ListCustomersQuery> = {}) {
  return useQuery({
    queryKey: customerKeys.trashedList(params as ListCustomersQuery),
    queryFn: async () => {
      const { data, error } = await api.customers.trashed.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.customers({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data, error } = await api.customers.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateCustomerInput & { id: string }) => {
      const { data, error } = await api.customers({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: customerKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.customers({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerKeys.trashed() })
    },
  })
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.customers({ id }).restore.post()
      if (error) throw error
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customerKeys.trashed() })
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
    },
  })
}
