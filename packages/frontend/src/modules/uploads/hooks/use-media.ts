import { useQuery } from '@tanstack/react-query'
import { api } from '#lib/api'

export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (params: { page?: number; pageSize?: number; purpose?: string }) =>
    [...mediaKeys.lists(), params] as const,
  details: () => [...mediaKeys.all, 'detail'] as const,
  detail: (id: string) => [...mediaKeys.details(), id] as const,
}

export type { Media } from 'backend/src/modules/uploads/uploads.route'

export function useMedia(id: string) {
  return useQuery({
    queryKey: mediaKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await api.uploads({ id }).get()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useMediaUrl(id: string) {
  const { data: media } = useMedia(id)
  return media?.url ?? null
}

export function useMediaList(
  params: {
    page?: number
    pageSize?: number
    purpose?: string
  } = {},
) {
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: async () => {
      const { data, error } = await api.uploads.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          purpose: params.purpose,
        },
      })
      if (error) throw error
      return data
    },
  })
}
