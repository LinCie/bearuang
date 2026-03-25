import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateWarehouseInput,
  ListWarehousesQuery,
  UpdateWarehouseInput,
  Warehouse,
} from 'backend/src/modules/warehouses/warehouses.route'

// ─── Query Keys ──────────────────────────────────────────────

export const warehouseKeys = {
  all: ['warehouses'] as const,
  lists: () => [...warehouseKeys.all, 'list'] as const,
  list: (params: ListWarehousesQuery) =>
    [...warehouseKeys.lists(), params] as const,
  details: () => [...warehouseKeys.all, 'detail'] as const,
  detail: (id: string) => [...warehouseKeys.details(), id] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateWarehouseInput,
  ListWarehousesQuery,
  UpdateWarehouseInput,
  Warehouse,
}

// ─── Queries ─────────────────────────────────────────────────

export function useWarehouses(params: ListWarehousesQuery = {}) {
  return useQuery({
    queryKey: warehouseKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.warehouses.get({
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

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.warehouses({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWarehouseInput) => {
      const { data, error } = await api.warehouses.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() })
    },
  })
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateWarehouseInput & { id: string }) => {
      const { data, error } = await api.warehouses({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: warehouseKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.warehouses({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() })
    },
  })
}
