import { prisma } from '#integrations/prisma'

const DEFAULT_ORDER = { createdAt: 'desc' } as const

export const auditService = {
  async listAuditLogs(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      model?: string
      operation?: string
      authType?: string
      userId?: string
    },
  ) {
    const where = {
      organizationId,
      ...(params?.model && { model: params.model }),
      ...(params?.operation && { operation: params.operation }),
      ...(params?.authType && { authType: params.authType }),
      ...(params?.userId && { userId: params.userId }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true } },
          apiKey: { select: { name: true } },
        },
        orderBy: DEFAULT_ORDER,
        skip: params?.skip,
        take: params?.take ?? 50,
      }),
      prisma.auditLog.count({ where }),
    ])
    return { data, total }
  },
}
