import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from './api'

interface PermissionsData {
  viewResources: Set<string>
  allPermissions: Set<string>
}

async function fetchPermissions(): Promise<PermissionsData> {
  const { data } = await api.permissions.get()
  return {
    viewResources: new Set(data?.viewResources ?? []),
    allPermissions: new Set(data?.permissions ?? []),
  }
}

export const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
  return data?.allPermissions.has(permission) ?? false
}
