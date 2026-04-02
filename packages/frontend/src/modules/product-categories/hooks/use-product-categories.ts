import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { auditLogKeys } from '@/modules/audit-logs/hooks/use-audit-logs'
import { productKeys } from '@/modules/products/hooks/use-products'
import type {
  CreateProductCategoryInput,
  ListProductCategoriesQuery,
  ListCategoryProductsQuery,
  UpdateProductCategoryInput,
  ProductCategory,
  TrashedProductCategory,
} from 'backend/src/modules/product-categories/product-categories.route'

// ─── Query Keys ──────────────────────────────────────────────

export const productCategoryKeys = {
  all: ['product-categories'] as const,
  lists: () => [...productCategoryKeys.all, 'list'] as const,
  list: (params: ListProductCategoriesQuery) =>
    [...productCategoryKeys.lists(), params] as const,
  trashed: () => [...productCategoryKeys.all, 'trashed'] as const,
  trashedList: (params: ListProductCategoriesQuery) =>
    [...productCategoryKeys.trashed(), params] as const,
  details: () => [...productCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productCategoryKeys.details(), id] as const,
  categoryProducts: (id: string) =>
    [...productCategoryKeys.detail(id), 'products'] as const,
  categoryProductsList: (id: string, params: ListCategoryProductsQuery) =>
    [...productCategoryKeys.categoryProducts(id), params] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  CreateProductCategoryInput,
  ListProductCategoriesQuery,
  ListCategoryProductsQuery,
  UpdateProductCategoryInput,
  ProductCategory,
  TrashedProductCategory,
}

// ─── Queries ─────────────────────────────────────────────────

export function useProductCategories(
  params: Partial<ListProductCategoriesQuery> = {},
) {
  return useQuery({
    queryKey: productCategoryKeys.list(params as ListProductCategoriesQuery),
    queryFn: async () => {
      const { data, error } = await api['product-categories'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
          parentId: params.parentId,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useTrashedProductCategories(
  params: Partial<ListProductCategoriesQuery> = {},
) {
  return useQuery({
    queryKey: productCategoryKeys.trashedList(
      params as ListProductCategoriesQuery,
    ),
    queryFn: async () => {
      const { data, error } = await api['product-categories'].trashed.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy === 'sortOrder' ? undefined : params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useProductCategory(id: string) {
  return useQuery({
    queryKey: productCategoryKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api['product-categories']({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCategoryProducts(
  categoryId: string,
  params: Partial<ListCategoryProductsQuery> = {},
) {
  return useQuery({
    queryKey: productCategoryKeys.categoryProductsList(
      categoryId,
      params as ListCategoryProductsQuery,
    ),
    queryFn: async () => {
      const { data, error } = await api['product-categories']({
        id: categoryId,
      }).products.get({
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
    enabled: !!categoryId,
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProductCategoryInput) => {
      const { data, error } = await api['product-categories'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.lists(),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useUpdateProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateProductCategoryInput & { id: string }) => {
      const { data, error } = await api['product-categories']({ id }).patch(
        input,
      )
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['product-categories']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.trashed(),
      })
      queryClient.invalidateQueries({
        queryKey: productKeys.lists(),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useRestoreProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['product-categories']({
        id,
      }).restore.post()
      if (error) throw error
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.trashed(),
      })
      queryClient.invalidateQueries({
        queryKey: productCategoryKeys.detail(id),
      })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
