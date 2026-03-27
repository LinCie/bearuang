import { prisma } from '@/integrations/prisma'
import { auth } from '@/integrations/auth'

export const invitationsService = {
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
          : { createdAt: 'desc' },
      }),
      prisma.invitation.count({ where }),
    ])
    return { data, total }
  },

  async getInvitation(organizationId: string, id: string) {
    return prisma.invitation.findFirst({
      where: { id, organizationId },
    })
  },

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

  async cancelInvitation(headers: Headers, invitationId: string) {
    return auth.api.cancelInvitation({
      headers,
      body: { invitationId },
    })
  },

  async acceptInvitation(headers: Headers, invitationId: string) {
    return auth.api.acceptInvitation({
      headers,
      body: { invitationId },
    })
  },

  async rejectInvitation(headers: Headers, invitationId: string) {
    return auth.api.rejectInvitation({
      headers,
      body: { invitationId },
    })
  },
}
