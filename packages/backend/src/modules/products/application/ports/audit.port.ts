export interface AuditPortInput {
  organizationId: string
  userId: string
  apiKeyId?: string
  authType: 'session' | 'api_key'
  model: string
  operation: string
  args: Record<string, unknown>
}

export interface AuditPort {
  log(input: AuditPortInput): Promise<void>
}
