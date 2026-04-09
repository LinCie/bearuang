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
  /**
   * Processes a chat message through the AI assistant with tool calling capabilities.
   * @param params - Chat parameters including user message, conversation history, and auth context.
   * @param params.userMessage - The current user message to process.
   * @param params.conversationHistory - Array of previous conversation messages.
   * @param params.confirmedWriteTools - List of tool names the user has confirmed for write operations.
   * @param params.userId - The authenticated user's identifier.
   * @param params.organizationId - The user's organization identifier.
   * @param params.userRole - The user's role in the organization.
   * @param params.authType - The authentication type (session, api-key, etc.).
   * @param params.checkPermission - Function to check if user has a specific permission.
   * @returns The AI assistant's result including reply, pending actions, and action results.
   * @usage Used in ai.route.ts
   * @sideEffects None (Read-only) - Tool execution side effects depend on individual tool implementations.
   */
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
