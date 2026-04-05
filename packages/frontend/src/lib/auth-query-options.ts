import { queryOptions } from '@tanstack/react-query'
import { authClient } from './auth-client'

export const activeMemberQueryOptions = queryOptions({
  queryKey: ['active-member'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.getActiveMember()
    if (error) throw new Error(error.message)
    return data
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
  networkMode: 'offlineFirst',
})

export const listOrganizationsQueryOptions = queryOptions({
  queryKey: ['organizations', 'list'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.list()
    if (error) throw new Error(error.message)
    return data
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
  networkMode: 'offlineFirst',
})

export const activeOrganizationQueryOptions = queryOptions({
  queryKey: ['active-organization'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.getFullOrganization()
    if (error) throw new Error(error.message)
    return data
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
  networkMode: 'offlineFirst',
})
