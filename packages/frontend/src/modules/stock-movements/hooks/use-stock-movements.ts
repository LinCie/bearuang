import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { variantKeys } from '@/modules/products/hooks/use-variants'

// ─── Types ───────────────────────────────────────────────────

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT'

export interface StockMovement {
  id: string
  organizationId: string
  warehouseId: string
  variantId: string
  type: StockMovementType
  quantity: number
  referenceId: string | null
  referenceType: string | null
  note: string | null
  createdAt: string
  variant: { id: string; sku: string; name: string }
  warehouse: { id: string; name: string }
}

export interface PaginatedStockMovements {
  data: StockMovement[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Query Keys ──────────────────────────────────────────────

export const stockMovementKeys = {
  all: ['stock-movements'] as const,
  lists: () => [...stockMovementKeys.all, 'list'] as const,
  list: (params: ListStockMovementsParams) =>
    [...stockMovementKeys.lists(), params] as const,
  details: () => [...stockMovementKeys.all, 'detail'] as const,
  detail: (id: string) => [...stockMovementKeys.details(), id] as const,
  byVariant: (variantId: string) =>
    [...stockMovementKeys.all, 'byVariant', variantId] as const,
  byWarehouse: (warehouseId: string) =>
    [...stockMovementKeys.all, 'byWarehouse', warehouseId] as const,
}

// ─── Parameter Types ─────────────────────────────────────────

export interface ListStockMovementsParams {
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'quantity' | 'type'
  sortOrder?: 'asc' | 'desc'
  variantId?: string
  warehouseId?: string
  type?: StockMovementType
}

export interface CreateStockMovementInput {
  warehouseId: string
  variantId: string
  type: StockMovementType
  quantity: number
  referenceId?: string
  referenceType?: string
  note?: string
}

export interface UpdateStockMovementInput {
  warehouseId?: string
  variantId?: string
  type?: StockMovementType
  quantity?: number
  note?: string
}

// ─── Queries ─────────────────────────────────────────────────

export function useStockMovements(params: ListStockMovementsParams = {}) {
  return useQuery({
    queryKey: stockMovementKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api['stock-movements'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          variantId: params.variantId,
          warehouseId: params.warehouseId,
          type: params.type,
        },
      })
      if (error) throw error
      return data as PaginatedStockMovements
    },
  })
}

export function useStockMovement(id: string) {
  return useQuery({
    queryKey: stockMovementKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['stock-movements']({ id }).get()
      if (error) throw error
      return data as StockMovement
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
      return data as PaginatedStockMovements
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
      return data as PaginatedStockMovements
    },
    enabled: !!warehouseId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateStockMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateStockMovementInput) => {
      const { data, error } = await api['stock-movements'].post(input)
      if (error) throw error
      return data as StockMovement
    },
    onSuccess: (_data, variables) => {
      // Invalidate stock movement lists
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.lists(),
      })
      // Invalidate specific variant stock movements
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.byVariant(variables.variantId),
      })
      // Invalidate specific warehouse stock movements
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.byWarehouse(variables.warehouseId),
      })
      // Invalidate variant data since stock changed
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.variantId),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
    },
  })
}

export function useUpdateStockMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateStockMovementInput & { id: string }) => {
      const { data, error } = await api['stock-movements']({ id }).patch(input)
      if (error) throw error
      return data as StockMovement
    },
    onSuccess: (_data, variables) => {
      // Invalidate stock movement lists
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.lists(),
      })
      // Invalidate specific movement detail
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.detail(variables.id),
      })
      // Invalidate variant lists since stock changed
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.all,
      })
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
      // Invalidate all stock movement lists
      queryClient.invalidateQueries({
        queryKey: stockMovementKeys.lists(),
      })
      // Invalidate variant lists since stock was reversed
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: variantKeys.all,
      })
    },
  })
}
