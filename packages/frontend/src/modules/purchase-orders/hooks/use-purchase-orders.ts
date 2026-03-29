import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
import { variantKeys } from '@/modules/products/hooks/use-variants'
import type {
  CreatePurchaseOrderInput,
  ListPurchaseOrdersQuery,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  PurchaseOrder,
} from 'backend/src/modules/purchase-orders/purchase-orders.route'

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreatePurchaseOrderInput,
  ListPurchaseOrdersQuery,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  PurchaseOrder,
}

// ─── Query Keys ──────────────────────────────────────────────

export const purchaseOrderKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (params: ListPurchaseOrdersQuery) =>
    [...purchaseOrderKeys.lists(), params] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
  bySupplier: (supplierId: string) =>
    [...purchaseOrderKeys.all, 'bySupplier', supplierId] as const,
  byWarehouse: (warehouseId: string) =>
    [...purchaseOrderKeys.all, 'byWarehouse', warehouseId] as const,
}

// ─── Queries ─────────────────────────────────────────────────

export function usePurchaseOrders(params: ListPurchaseOrdersQuery) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api['purchase-orders'].get({
        query: {
          page: params.page || 1,
          pageSize: params.pageSize || 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          status: params.status,
          paymentStatus: params.paymentStatus,
          supplierId: params.supplierId,
          warehouseId: params.warehouseId,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['purchase-orders']({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useSupplierPurchaseOrders(supplierId: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.bySupplier(supplierId),
    queryFn: async () => {
      const { data, error } = await api['purchase-orders'].get({
        query: { supplierId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!supplierId,
  })
}

export function useWarehousePurchaseOrders(warehouseId: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.byWarehouse(warehouseId),
    queryFn: async () => {
      const { data, error } = await api['purchase-orders'].get({
        query: { warehouseId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!warehouseId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      const { data, error } = await api['purchase-orders'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.lists(),
      })
      if (variables.supplierId) {
        queryClient.invalidateQueries({
          queryKey: purchaseOrderKeys.bySupplier(variables.supplierId),
        })
      }
      if (variables.warehouseId) {
        queryClient.invalidateQueries({
          queryKey: purchaseOrderKeys.byWarehouse(variables.warehouseId),
        })
      }
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdatePurchaseOrderInput & { id: string }) => {
      const { data, error } = await api['purchase-orders']({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.id),
      })
      if (variables.supplierId) {
        queryClient.invalidateQueries({
          queryKey: purchaseOrderKeys.bySupplier(variables.supplierId),
        })
      }
      if (variables.warehouseId) {
        queryClient.invalidateQueries({
          queryKey: purchaseOrderKeys.byWarehouse(variables.warehouseId),
        })
      }
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: ReceivePurchaseOrderInput & { id: string }) => {
      const { data, error } = await api['purchase-orders']({ id }).receive.post(
        input,
      )
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(data.id),
      })
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.bySupplier(data.supplierId),
      })
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.byWarehouse(data.warehouseId),
      })
      // Invalidate variant stock since receiving creates stock movements
      for (const item of data.items) {
        queryClient.invalidateQueries({
          queryKey: variantKeys.detail(item.variantId),
        })
      }
      queryClient.invalidateQueries({
        queryKey: variantKeys.lists(),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['purchase-orders']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.all,
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
