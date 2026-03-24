import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from 'backend/src/modules/products/products.route'

// ─── Query Keys ──────────────────────────────────────────────

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: ListProductsQuery) =>
    [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateProductInput,
  ListProductsQuery,
  Product,
  ProductVariant,
  UpdateProductInput,
} from 'backend/src/modules/products/products.route'

// ─── Queries ─────────────────────────────────────────────────

export function useProducts(params: ListProductsQuery = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.products.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.products({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data, error } = await api.products.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateProductInput & { id: string }) => {
      const { data, error } = await api.products({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.products({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}
