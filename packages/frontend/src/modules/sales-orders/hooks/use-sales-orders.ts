import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
import { variantKeys } from '@/modules/products/hooks/use-variants'
import type {
  CreateSalesOrderInput,
  ListSalesOrdersQuery,
  UpdateSalesOrderInput,
  SalesOrder,
} from 'backend/src/modules/sales-orders/sales-orders.route'

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateSalesOrderInput,
  ListSalesOrdersQuery,
  UpdateSalesOrderInput,
  SalesOrder,
}

// ─── Query Keys ──────────────────────────────────────────────

export const salesOrderKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesOrderKeys.all, 'list'] as const,
  list: (params: ListSalesOrdersQuery) =>
    [...salesOrderKeys.lists(), params] as const,
  details: () => [...salesOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderKeys.details(), id] as const,
  byCustomer: (customerId: string) =>
    [...salesOrderKeys.all, 'byCustomer', customerId] as const,
  byWarehouse: (warehouseId: string) =>
    [...salesOrderKeys.all, 'byWarehouse', warehouseId] as const,
}

// ─── Queries ─────────────────────────────────────────────────

export function useSalesOrders(params: Partial<ListSalesOrdersQuery> = {}) {
  return useQuery({
    queryKey: salesOrderKeys.list(params as ListSalesOrdersQuery),
    queryFn: async () => {
      const { data, error } = await api['sales-orders'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          status: params.status,
          paymentStatus: params.paymentStatus,
          customerId: params.customerId,
          search: params.search,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: salesOrderKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['sales-orders']({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCustomerSalesOrders(customerId: string) {
  return useQuery({
    queryKey: salesOrderKeys.byCustomer(customerId),
    queryFn: async () => {
      const { data, error } = await api['sales-orders'].get({
        query: { customerId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!customerId,
  })
}

export function useWarehouseSalesOrders(warehouseId: string) {
  return useQuery({
    queryKey: salesOrderKeys.byWarehouse(warehouseId),
    queryFn: async () => {
      const { data, error } = await api['sales-orders'].get({
        query: { warehouseId, page: 1, pageSize: 100 },
      })
      if (error) throw error
      return data
    },
    enabled: !!warehouseId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateSalesOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSalesOrderInput) => {
      const { data, error } = await api['sales-orders'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: salesOrderKeys.lists(),
      })
      if (variables.customerId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderKeys.byCustomer(variables.customerId),
        })
      }
      if (variables.warehouseId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderKeys.byWarehouse(variables.warehouseId),
        })
      }
      for (const item of variables.items) {
        queryClient.invalidateQueries({
          queryKey: variantKeys.detail(item.variantId),
        })
      }
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateSalesOrderInput & { id: string }) => {
      const { data, error } = await api['sales-orders']({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: salesOrderKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: salesOrderKeys.detail(variables.id),
      })
      if (variables.customerId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderKeys.byCustomer(variables.customerId),
        })
      }
      if (variables.warehouseId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderKeys.byWarehouse(variables.warehouseId),
        })
      }
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['sales-orders']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: salesOrderKeys.all,
      })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
