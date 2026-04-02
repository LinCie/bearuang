import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { invitationsService } from './invitations.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

export const invitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  inviterId: z.string(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
})

export const createInvitationDto = z.object({
  email: z.string().email(),
  role: z.string().min(1),
})

export const invitationIdParam = z.object({
  id: z.string(),
})

export const listInvitationsQuery = paginationQuery
  .extend(sortQuery(['status', 'createdAt', 'email']).shape)
  .extend({
    search: z.string().optional(),
    status: z.string().optional(),
  })

export type Invitation = z.infer<typeof invitationSchema>

export const pendingInvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  inviterId: z.string(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  organizationName: z.string(),
})

export type PendingInvitation = z.infer<typeof pendingInvitationSchema>
export type CreateInvitationInput = z.infer<typeof createInvitationDto>
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuery>

type InvitationData = {
  id: string
  organizationId: string
  email: string
  role: string | null
  status: string
  inviterId: string
  expiresAt: Date
  createdAt: Date
  organization?: { name: string }
}

const serializeInvitation = (inv: InvitationData) => ({
  id: inv.id,
  organizationId: inv.organizationId,
  email: inv.email,
  role: inv.role ?? null,
  status: inv.status,
  inviterId: inv.inviterId,
  expiresAt: inv.expiresAt.toISOString(),
  createdAt: inv.createdAt.toISOString(),
})

const serializePendingInvitation = (
  inv: InvitationData & { organization: { name: string } },
) => ({
  ...serializeInvitation(inv),
  organizationName: inv.organization.name,
})

export const invitationsRoute = new Elysia({
  prefix: '/invitations',
  tags: ['Invitations'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, search, status, sortBy, sortOrder } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await invitationsService.listInvitations(
        organization.id,
        {
          skip,
          take,
          search,
          status,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? 'desc' }
            : undefined,
        },
      )
      return {
        data: (data as InvitationData[]).map(serializeInvitation),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { invitation: ['view'] },
      query: listInvitationsQuery,
      response: {
        200: paginatedResponse(invitationSchema),
      },
      detail: {
        summary: 'List invitations',
        description:
          'Retrieves a paginated list of invitations for the authenticated organization.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const invitation = await invitationsService.getInvitation(
        organization.id,
        params.id,
      )
      if (!invitation) return status(404, { message: 'Invitation not found' })
      return serializeInvitation(invitation as InvitationData)
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { invitation: ['view'] },
      params: invitationIdParam,
      response: {
        200: invitationSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get an invitation',
        description:
          'Retrieves the details of a specific invitation by its ID.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, request, body, status }) => {
      try {
        const invitation = await invitationsService.createInvitation(
          request.headers,
          body,
        )
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Invitation',
          operation: 'create',
          args: { data: body },
        })
        return status(
          201,
          serializeInvitation(invitation as unknown as InvitationData),
        )
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to create invitation'
        return status(400, { message })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { invitation: ['create'] },
      body: createInvitationDto,
      response: {
        201: invitationSchema,
        400: errorResponse,
      },
      detail: {
        summary: 'Create an invitation',
        description:
          'Sends an invitation to join the authenticated organization with the specified role.',
      },
    },
  )
  .post(
    '/:id/accept',
    async ({ _authType, user, request, params, status }) => {
      try {
        const result = await invitationsService.acceptInvitation(
          request.headers,
          params.id,
        )
        void logAudit({
          organizationId:
            ((result as Record<string, unknown>).organizationId as string) ??
            '',
          userId: user.id,
          authType: _authType,
          model: 'Invitation',
          operation: 'accept',
          args: { id: params.id },
        })
        const typedResult = result as unknown as {
          invitation: InvitationData | null
          member: {
            id: string
            organizationId: string
            userId: string
            role: string
            createdAt: Date
          } | null
        }
        return {
          invitation: typedResult.invitation
            ? serializeInvitation(typedResult.invitation)
            : null,
          member: typedResult.member
            ? {
                id: typedResult.member.id,
                organizationId: typedResult.member.organizationId,
                userId: typedResult.member.userId,
                role: typedResult.member.role,
                createdAt: typedResult.member.createdAt.toISOString(),
              }
            : null,
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to accept invitation'
        return status(400, { message })
      }
    },
    {
      requireAuth: true,
      params: invitationIdParam,
      response: {
        200: z.object({
          invitation: invitationSchema.nullable(),
          member: z
            .object({
              id: z.string(),
              organizationId: z.string(),
              userId: z.string(),
              role: z.string(),
              createdAt: z.iso.datetime(),
            })
            .nullable(),
        }),
        400: errorResponse,
      },
      detail: {
        summary: 'Accept an invitation',
        description:
          'Accepts a pending invitation and adds the user as a member of the organization.',
      },
    },
  )
  .post(
    '/:id/reject',
    async ({ _authType, user, request, params, status }) => {
      try {
        const result = await invitationsService.rejectInvitation(
          request.headers,
          params.id,
        )
        void logAudit({
          organizationId:
            ((result as Record<string, unknown>).organizationId as string) ??
            '',
          userId: user.id,
          authType: _authType,
          model: 'Invitation',
          operation: 'reject',
          args: { id: params.id },
        })
        const typedResult = result as unknown as {
          invitation: InvitationData | null
          member: null
        }
        return {
          invitation: typedResult.invitation
            ? serializeInvitation(typedResult.invitation)
            : null,
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to reject invitation'
        return status(400, { message })
      }
    },
    {
      requireAuth: true,
      params: invitationIdParam,
      response: {
        200: z.object({
          invitation: invitationSchema.nullable(),
        }),
        400: errorResponse,
      },
      detail: {
        summary: 'Reject an invitation',
        description: 'Rejects a pending invitation to join the organization.',
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, request, params, status }) => {
      try {
        const invitation = await invitationsService.cancelInvitation(
          request.headers,
          params.id,
        )
        if (!invitation) return status(404, { message: 'Invitation not found' })
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Invitation',
          operation: 'delete',
          args: { id: params.id },
        })
        return status(200, { message: 'Invitation cancelled' })
      } catch {
        return status(404, { message: 'Invitation not found' })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { invitation: ['delete'] },
      params: invitationIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Cancel an invitation',
        description: 'Cancels a pending invitation to the organization.',
      },
    },
  )
  .get(
    '/my-pending',
    async ({ user }) => {
      const invitations = await invitationsService.getPendingInvitationsForUser(
        user.email,
      )
      return {
        data: invitations.map(serializePendingInvitation),
      }
    },
    {
      requireAuth: true,
      response: {
        200: z.object({
          data: z.array(pendingInvitationSchema),
        }),
      },
      detail: {
        summary: 'Get my pending invitations',
        description:
          'Retrieves all pending invitations sent to the current user.',
      },
    },
  )
