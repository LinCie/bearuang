import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
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

export function useVariants(params: Partial<SearchVariantQuery> = {}) {
  return useQuery({
    queryKey: variantKeys.list(params as SearchVariantQuery),
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

export function useProductTrashedVariants(productId: string) {
  return useQuery({
    queryKey: [...variantKeys.byProduct(productId), 'trashed'],
    queryFn: async () => {
      // Note: We'll use the global variants trashed endpoint for now and filter by productId
      // or we can add a specific endpoint. Since we have a global one, let's use it with search or just filter.
      // Better: let's assume we might need a specific endpoint if we wanted, but for now
      // let's just use the global one and filter.
      const { data, error } = await api.variants.trashed.get({
        query: { page: 1, search: productId, pageSize: 100 },
      })
      if (error) throw error
      return data.data.filter((v: any) => v.productId === productId)
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
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
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
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
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
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRestoreVariant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.variants({ id }).restore.post()
      if (error) throw error
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

// ─── Image Mutations ───────────────────────────────────────────

export function useAddVariantImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      variantId,
      mediaId,
      altText,
    }: {
      variantId: string
      mediaId: string
      altText?: string
    }) => {
      const { data, error } = await api
        .variants({ id: variantId })
        .images.post({ mediaId, altText })
      if (error) throw error
      return data
    },
    onSuccess: (_data, { variantId }) => {
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variantId),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRemoveVariantImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      variantId,
      imageId,
    }: {
      variantId: string
      imageId: string
    }) => {
      const { error } = await api
        .variants({ id: variantId })
        .images({ imageId })
        .delete()
      if (error) throw error
    },
    onSuccess: (_data, { variantId }) => {
      queryClient.invalidateQueries({
        queryKey: variantKeys.detail(variantId),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
