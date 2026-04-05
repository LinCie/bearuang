import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from './api'

interface PermissionsData {
  viewResources: string[]
  allPermissions: string[]
}

async function fetchPermissions(): Promise<PermissionsData> {
  const { data } = await api.permissions.get()
  return {
    viewResources: data?.viewResources ?? [],
    allPermissions: data?.permissions ?? [],
  }
}

export const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 5, // 5 minutes
    networkMode: 'offlineFirst',
  })

export function usePermissions() {
  return useQuery(permissionsQueryOptions())
}

/**
 * Checks if the current user has a specific permission.
 * @param permission - Permission string in "resource:action" format (e.g., "product:create")
 * @returns boolean indicating if the user has the permission
 */
export function useHasPermission(permission: string): boolean {
  const { data } = usePermissions()
  return data?.allPermissions.includes(permission) ?? false
}
