import type { RunToolLoopResult } from '#integrations/llm'
import { runToolLoop } from '#integrations/llm'
import { allTools, systemPrompt, buildExecuteTool } from './tools'

/**
 * AI Service that provides a chat interface with tool calling capabilities
 * for inventory management operations.
 *
 * @param params - Chat parameters including user message, conversation history, and auth context.
 * @returns The AI assistant's result including reply, pending actions, and action results.
 */
export const aiService = {
  async chat(params: {
    userMessage: string
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
    confirmedWriteTools?: string[]
    userId: string
    organizationId: string
    userRole: string
    authType: string
    checkPermission: (permission: string) => Promise<boolean>
  }): Promise<RunToolLoopResult> {
    return runToolLoop({
      systemPrompt,
      userMessage: params.userMessage,
      conversationHistory: params.conversationHistory,
      tools: allTools,
      maxIterations: 10,
      confirmedWriteTools: params.confirmedWriteTools,
      toolContext: {
        userId: params.userId,
        organizationId: params.organizationId,
        userRole: params.userRole,
        authType: params.authType,
      },
      executeTool: buildExecuteTool(params),
    })
  },
}
