import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
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
  trashed: () => [...productKeys.all, 'trashed'] as const,
  trashedList: (params: ListProductsQuery) =>
    [...productKeys.trashed(), params] as const,
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

export function useProducts(params: Partial<ListProductsQuery> = {}) {
  return useQuery({
    queryKey: productKeys.list(params as ListProductsQuery),
    queryFn: async () => {
      const { data, error } = await api.products.get({
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

export function useTrashedProducts(params: Partial<ListProductsQuery> = {}) {
  return useQuery({
    queryKey: productKeys.trashedList(params as ListProductsQuery),
    queryFn: async () => {
      const { data, error } = await api.products.trashed.get({
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
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
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
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
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
      queryClient.invalidateQueries({ queryKey: productKeys.trashed() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRestoreProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.products({ id }).restore.post()
      if (error) throw error
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productKeys.trashed() })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

// ─── Image Mutations ───────────────────────────────────────────

export function useAddProductImage(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      mediaId,
      altText,
    }: {
      mediaId: string
      altText?: string
    }) => {
      const { data, error } = await api
        .products({ id: productId })
        .images.post({ mediaId, altText })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRemoveProductImage(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await api
        .products({ id: productId })
        .images({ imageId })
        .delete()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useReorderProductImages(productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (imageIds: string[]) => {
      const { error } = await api
        .products({ id: productId })
        .images.reorder.patch({ imageIds })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
