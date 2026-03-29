import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ListAuditLogsQuery,
  AuditLog,
} from 'backend/src/modules/audit/audit.route'

export type { AuditLog, ListAuditLogsQuery }

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (params: ListAuditLogsQuery) =>
    [...auditLogKeys.lists(), params] as const,
}

export function useAuditLogs(params: Partial<ListAuditLogsQuery> = {}) {
  return useQuery({
    queryKey: auditLogKeys.list(params as ListAuditLogsQuery),
    queryFn: async () => {
      const { data, error } = await api['audit-logs'].get({
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          model: params.model,
          operation: params.operation,
          authType: params.authType,
          userId: params.userId,
        },
      })
      if (error) throw error
      return data
    },
  })
}
