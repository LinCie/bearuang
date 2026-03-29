import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
import { variantKeys } from '@/modules/products/hooks/use-variants'
import type {
  CreateMovementInput,
  ListMovementsQuery,
  StockMovementType,
  StockMovementWithRelations,
} from 'backend/src/modules/stock-movements/stock-movements.route'

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateMovementInput,
  ListMovementsQuery,
  StockMovementType,
  StockMovementWithRelations as StockMovement,
}

// ─── Query Keys ──────────────────────────────────────────────

export const stockMovementKeys = {
  all: ['stock-movements'] as const,
  lists: () => [...stockMovementKeys.all, 'list'] as const,
  list: (params: ListMovementsQuery) =>
    [...stockMovementKeys.lists(), params] as const,
  details: () => [...stockMovementKeys.all, 'detail'] as const,
  detail: (id: string) => [...stockMovementKeys.details(), id] as const,
  byVariant: (variantId: string) =>
    [...stockMovementKeys.all, 'byVariant', variantId] as const,
  byWarehouse: (warehouseId: string) =>
    [...stockMovementKeys.all, 'byWarehouse', warehouseId] as const,
  byReference: (referenceId: string, referenceType: string) =>
    [
      ...stockMovementKeys.all,
      'byReference',
      referenceType,
      referenceId,
    ] as const,
}

// ─── Queries ─────────────────────────────────────────────────

export function useStockMovements(params: Partial<ListMovementsQuery> = {}) {
  return useQuery({
    queryKey: stockMovementKeys.list(params as ListMovementsQuery),
    queryFn: async () => {
      const { data, error } = await api['stock-movements'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
          variantId: params.variantId,
          warehouseId: params.warehouseId,
          type: params.type,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useStockMovement(id: string) {
  return useQuery({
    queryKey: stockMovementKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['stock-movements']({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useVariantStockMovements(variantId: string) {
  return useQuery({
    queryKey: stockMovementKeys.byVariant(variantId),
    queryFn: async () => {
      const { data, error } = await api['stock-movements'].get({
        query: { variantId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!variantId,
  })
}

export function useWarehouseStockMovements(warehouseId: string) {
  return useQuery({
    queryKey: stockMovementKeys.byWarehouse(warehouseId),
    queryFn: async () => {
      const { data, error } = await api['stock-movements'].get({
        query: { warehouseId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!warehouseId,
  })
}

export function useStockMovementsByReference(
  referenceId: string,
  referenceType: string,
) {
  return useQuery({
    queryKey: stockMovementKeys.byReference(referenceId, referenceType),
    queryFn: async () => {
      const { data, error } = await api['stock-movements'].get({
        query: { referenceId, referenceType, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!referenceId && !!referenceType,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateStockMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateMovementInput) => {
      const { data, error } = await api['stock-movements'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.byVariant(variables.variantId),
      })
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.byWarehouse(variables.warehouseId),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantId),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteStockMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['stock-movements']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.all,
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
