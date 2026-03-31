import { prisma } from '#integrations/prisma'
import { logger } from '#libraries/utilities'

interface AuditInput {
  organizationId: string
  userId: string
  apiKeyId?: string
  authType: 'session' | 'api_key'
  model: string
  operation: string
  args: Record<string, unknown>
}

async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "audit_log" ("id", "organizationId", "userId", "apiKeyId", "authType", "model", "operation", "args", "createdAt")
      VALUES (
        uuidv7(),
        ${input.organizationId}::text,
        ${input.userId ?? null}::text,
        ${input.apiKeyId ?? null}::text,
        ${input.authType}::text,
        ${input.model}::text,
        ${input.operation}::text,
        ${JSON.stringify(input.args)}::jsonb,
        now()
      )
    `
  } catch (err) {
    logger.error(
      { err, model: input.model, operation: input.operation },
      'audit log write failed',
    )
  }
}

export { logAudit }
export type { AuditInput }
