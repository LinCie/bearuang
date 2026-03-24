import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateVariantInput,
  SearchVariantQuery,
  UpdateVariantInput,
  Variant,
  VariantWithProduct,
} from 'backend/src/modules/variants/variants.route'

// ─── Query Keys ──────────────────────────────────────────────

export const variantKeys = {
  all: ['variants'] as const,
  lists: () => [...variantKeys.all, 'list'] as const,
  list: (params: SearchVariantQuery) =>
    [...variantKeys.lists(), params] as const,
  details: () => [...variantKeys.all, 'detail'] as const,
  detail: (id: string) => [...variantKeys.details(), id] as const,
  byProduct: (productId: string) =>
    [...variantKeys.all, 'byProduct', productId] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateVariantInput,
  SearchVariantQuery,
  UpdateVariantInput,
  Variant,
  VariantWithProduct,
}

// ─── Queries ─────────────────────────────────────────────────

export function useVariants(params: SearchVariantQuery = {}) {
  return useQuery({
    queryKey: variantKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.variants.get({
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

export function useVariant(id: string) {
  return useQuery({
    queryKey: variantKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.variants({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useProductVariants(productId: string) {
  return useQuery({
    queryKey: variantKeys.byProduct(productId),
    queryFn: async () => {
      const { data, error } = await api
        .products({ id: productId })
        .variants.get()
      if (error) throw error
      return data
    },
    enabled: !!productId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateVariant(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      const { data, error } = await api
        .products({ id: productId })
        .variants.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: variantKeys.byProduct(productId),
      })
      queryClient.invalidateQueries({
        queryKey: ['products', 'detail', productId],
      })
    },
  })
}

export function useUpdateVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateVariantInput & { id: string }) => {
      const { data, error } = await api.variants({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.variants({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
    },
  })
}
