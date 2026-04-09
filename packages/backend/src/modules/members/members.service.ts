import { prisma } from '#integrations/prisma'
import { auth } from '#integrations/auth'

const memberInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
} as const

export const membersService = {
  /**
   * Lists members of an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of members and total count.
   * @usage Used in members.route.ts
   * @sideEffects None (Read-only)
   */
  async listMembers(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      orderBy?: {
        field: 'role' | 'createdAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      ...(params?.search && {
        OR: [
          {
            user: {
              name: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              email: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        include: memberInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single member by ID.
   * @param organizationId - Organization identifier.
   * @param id - Member identifier.
   * @returns The member record or null if not found.
   * @usage Used in members.route.ts
   * @sideEffects None (Read-only)
   */
  async getMember(organizationId: string, id: string) {
    return prisma.member.findFirst({
      where: { id, organizationId },
      include: memberInclude,
    })
  },

  /**
   * Updates the role of a member.
   * @param headers - Request headers for authentication.
   * @param memberId - Member identifier.
   * @param role - New role to assign.
   * @returns The updated member record.
   * @usage Used in members.route.ts
   * @sideEffects Updates the role in the members table via better-auth.
   */
  async updateMemberRole(headers: Headers, memberId: string, role: string) {
    return auth.api.updateMemberRole({
      headers,
      body: { memberId, role },
    })
  },

  /**
   * Removes a member from an organization.
   * @param headers - Request headers for authentication.
   * @param memberId - Member identifier or email.
   * @returns The deletion result.
   * @usage Used in members.route.ts
   * @sideEffects Removes the member from the members table via better-auth.
   */
  async removeMember(headers: Headers, memberId: string) {
    return auth.api.removeMember({
      headers,
      body: { memberIdOrEmail: memberId },
    })
  },
}
