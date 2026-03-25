import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ListMembersQuery,
  UpdateMemberRoleInput as _UpdateMemberRoleInput,
} from 'backend/src/modules/members/members.route'
import type {
  CreateInvitationInput,
  ListInvitationsQuery,
} from 'backend/src/modules/invitations/invitations.route'

// ─── Query Keys ──────────────────────────────────────────────

export const memberKeys = {
  all: ['members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (params: ListMembersQuery) => [...memberKeys.lists(), params] as const,
}

export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  list: (params: ListInvitationsQuery) =>
    [...invitationKeys.lists(), params] as const,
}

// ─── Re-exports ──────────────────────────────────────────────

export type {
  Member,
  ListMembersQuery,
  UpdateMemberRoleInput,
} from 'backend/src/modules/members/members.route'

export type {
  Invitation,
  CreateInvitationInput,
  ListInvitationsQuery,
} from 'backend/src/modules/invitations/invitations.route'

// ─── Queries ─────────────────────────────────────────────────

export function useMembers(params: Partial<ListMembersQuery> = {}) {
  return useQuery({
    queryKey: memberKeys.list(params as ListMembersQuery),
    queryFn: async () => {
      const { data, error } = await api.members.get({
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

export function useInvitations(params: Partial<ListInvitationsQuery> = {}) {
  return useQuery({
    queryKey: invitationKeys.list(params as ListInvitationsQuery),
    queryFn: async () => {
      const { data, error } = await api.invitations.get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          search: params.search,
          status: params.status,
        },
      })
      if (error) throw error
      return data
    },
  })
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      const { data, error } = await api.invitations.post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.invitations({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: _UpdateMemberRoleInput & { id: string }) => {
      const { data, error } = await api.members({ id }).patch(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.members({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() })
    },
  })
}
