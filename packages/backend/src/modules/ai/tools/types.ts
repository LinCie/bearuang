import type { ToolDefinition, ToolContext } from '#integrations/llm'

export interface ToolHandlerContext extends ToolContext {
  authType: string
}

export interface ToolHandlerParams {
  authType: string
  checkPermission: (permission: string) => Promise<boolean>
}

export interface ToolHandler {
  (
    args: Record<string, unknown>,
    context: ToolHandlerContext,
    params: ToolHandlerParams,
  ): Promise<string>
}

export interface ToolModule {
  tools: ToolDefinition[]
  handlers: Record<string, ToolHandler>
  permissions: Record<string, string>
  systemPrompt: string
}
