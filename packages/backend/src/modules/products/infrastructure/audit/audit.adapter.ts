import { logAudit } from '#libraries/audit-logger'
import type { AuditPort } from '../../application/ports/audit.port'

export function createAuditAdapter(): AuditPort {
  return {
    log(input) {
      return logAudit(input)
    },
  }
}
