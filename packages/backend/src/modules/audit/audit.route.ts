import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '@/plugins/auth.plugin'
import { auditService } from './audit.service'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '@/common/pagination'

export const auditLogSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable(),
  apiKeyId: z.string().nullable(),
  authType: z.string(),
  model: z.string(),
  operation: z.string(),
  args: z.unknown(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
})

export const listAuditLogsQuery = paginationQuery
  .extend(sortQuery(['createdAt', 'model', 'operation']).shape)
  .extend({
    model: z.string().optional(),
    operation: z.string().optional(),
    authType: z.enum(['session', 'api_key']).optional(),
    userId: z.string().optional(),
  })

export type AuditLog = z.infer<typeof auditLogSchema>
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>

const serializeAuditLog = (log: {
  id: string
  organizationId: string
  userId: string | null
  apiKeyId: string | null
  authType: string
  model: string
  operation: string
  args: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}) => ({
  ...log,
  createdAt: log.createdAt.toISOString(),
})

export const auditRoute = new Elysia({
  prefix: '/audit-logs',
  tags: ['Audit Logs'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ organization, query }) => {
      const { page, pageSize, model, operation, authType, userId } = query
      const { skip, take } = paginationToSkipTake(page, pageSize)
      const { data, total } = await auditService.listAuditLogs(
        organization.id,
        { skip, take, model, operation, authType, userId },
      )
      return {
        data: data.map(serializeAuditLog),
        meta: buildPaginationMeta(total, page, pageSize),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { auditLog: ['view'] },
      query: listAuditLogsQuery,
      response: {
        200: paginatedResponse(auditLogSchema),
      },
      detail: {
        summary: 'List audit logs',
        description:
          'Retrieves a paginated list of audit logs for the authenticated organization. Supports filtering by model, operation, auth type, and user.',
      },
    },
  )
