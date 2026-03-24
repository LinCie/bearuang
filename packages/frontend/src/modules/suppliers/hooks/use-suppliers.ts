import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
  Supplier,
} from 'backend/src/modules/suppliers/suppliers.route'

// ─── Query Keys ──────────────────────────────────────────────

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (params: ListSuppliersQuery) =>
    [...supplierKeys.lists(), params] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateSupplierInput,
  ListSuppliersQuery,
  Supplier,
  UpdateSupplierInput,
}

// ─── Queries ─────────────────────────────────────────────────

export function useSuppliers(params: ListSuppliersQuery = {}) {
  return useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.suppliers.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          isActive: params.isActive,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.suppliers({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSupplierInput) => {
      const { data, error } = await api.suppliers.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
    },
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateSupplierInput & { id: string }) => {
      const { data, error } = await api.suppliers({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: supplierKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.suppliers({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
    },
  })
}
