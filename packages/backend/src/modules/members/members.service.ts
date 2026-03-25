import { prisma } from "@/integrations/prisma";
import { auth } from "@/integrations/auth";

export const membersService = {
  async listMembers(
    organizationId: string,
    params?: {
      skip?: number;
      take?: number;
      search?: string;
      orderBy?: {
        field: "role" | "createdAt";
        order: "asc" | "desc";
      };
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
                mode: "insensitive" as const,
              },
            },
          },
          {
            user: {
              email: {
                contains: params.search,
                mode: "insensitive" as const,
              },
            },
          },
        ],
      }),
    };
    const [data, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : { createdAt: "desc" },
      }),
      prisma.member.count({ where }),
    ]);
    return { data, total };
  },

  async getMember(organizationId: string, id: string) {
    return prisma.member.findFirst({
      where: { id, organizationId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
  },

  async updateMemberRole(headers: Headers, memberId: string, role: string) {
    return auth.api.updateMemberRole({
      headers,
      body: { memberId, role },
    });
  },

  async removeMember(headers: Headers, memberId: string) {
    return auth.api.removeMember({
      headers,
      body: { memberIdOrEmail: memberId },
    });
  },
};
