import { prisma } from '#integrations/prisma'
import { auth } from '#integrations/auth'

const invitationInclude = {
  organization: { select: { name: true } },
} as const

const defaultOrderBy = { createdAt: 'desc' } as const

export const invitationsService = {
  /**
   * Lists invitations for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search, status filter, and sorting parameters.
   * @returns The paginated list of invitations and total count.
   * @usage Used in invitations.route.ts
   * @sideEffects None (Read-only)
   */
  async listInvitations(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      status?: string
      orderBy?: {
        field: 'status' | 'createdAt' | 'email'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.status && { status: params.status }),
      ...(params?.search && {
        OR: [
          { email: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.invitation.findMany({
        where,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : defaultOrderBy,
      }),
      prisma.invitation.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single invitation by ID.
   * @param organizationId - Organization identifier.
   * @param id - Invitation identifier.
   * @returns The invitation record or null if not found.
   * @usage Used in invitations.route.ts
   * @sideEffects None (Read-only)
   */
  async getInvitation(organizationId: string, id: string) {
    return prisma.invitation.findFirst({
      where: { id, organizationId },
    })
  },

  /**
   * Creates a new invitation for a user to join an organization.
   * @param headers - Request headers for authentication.
   * @param data - Invitation data containing email and role.
   * @returns The created invitation result from better-auth.
   * @usage Used in invitations.route.ts
   * @sideEffects Creates a new record in the invitations table via better-auth.
   */
  async createInvitation(
    headers: Headers,
    data: { email: string; role: string },
  ) {
    return auth.api.createInvitation({
      headers,
      body: {
        email: data.email,
        role: data.role as 'member' | 'admin' | 'owner',
      },
    })
  },

  /**
   * Cancels a pending invitation.
   * @param headers - Request headers for authentication.
   * @param invitationId - Invitation identifier.
   * @returns The cancellation result from better-auth.
   * @usage Used in invitations.route.ts
   * @sideEffects Updates the invitation status to 'cancelled' via better-auth.
   */
  async cancelInvitation(headers: Headers, invitationId: string) {
    return auth.api.cancelInvitation({
      headers,
      body: { invitationId },
    })
  },

  /**
   * Accepts a pending invitation to join an organization.
   * @param headers - Request headers for authentication.
   * @param invitationId - Invitation identifier.
   * @returns The acceptance result from better-auth.
   * @usage Used in invitations.route.ts
   * @sideEffects Updates the invitation status to 'accepted' and creates a member record via better-auth.
   */
  async acceptInvitation(headers: Headers, invitationId: string) {
    return auth.api.acceptInvitation({
      headers,
      body: { invitationId },
    })
  },

  /**
   * Rejects a pending invitation to join an organization.
   * @param headers - Request headers for authentication.
   * @param invitationId - Invitation identifier.
   * @returns The rejection result from better-auth.
   * @usage Used in invitations.route.ts
   * @sideEffects Updates the invitation status to 'rejected' via better-auth.
   */
  async rejectInvitation(headers: Headers, invitationId: string) {
    return auth.api.rejectInvitation({
      headers,
      body: { invitationId },
    })
  },

  /**
   * Retrieves all pending invitations for a given email address.
   * @param email - User email address.
   * @returns The list of pending invitations with organization names.
   * @usage Used in invitations.route.ts
   * @sideEffects None (Read-only)
   */
  async getPendingInvitationsForUser(email: string) {
    return prisma.invitation.findMany({
      where: {
        email,
        status: 'pending',
      },
      include: invitationInclude,
      orderBy: defaultOrderBy,
    })
  },
}
