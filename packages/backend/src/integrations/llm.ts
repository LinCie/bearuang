import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'
import { logger } from '#libraries/utilities'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
  isWrite?: boolean
}

export interface PendingAction {
  tool: string
  args: Record<string, unknown>
}

export interface ActionResult {
  tool: string
  success: boolean
  data?: unknown
  error?: { code: string; message: string }
}

export interface RunToolLoopResult {
  reply: string
  pendingActions: PendingAction[]
  actionResults: ActionResult[]
}

export interface ToolContext {
  userId: string
  organizationId: string
  userRole: string
  authType: string
}

export interface ToolExecutor {
  (
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string>
}

export interface RunToolLoopConfig {
  systemPrompt: string
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: ToolDefinition[]
  executeTool: ToolExecutor
  toolContext: ToolContext
  maxIterations?: number
  confirmedWriteTools?: string[]
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_MAX_ITERATIONS = 10

let _llmClient: OpenAI | null = null

function createLlmClient(): OpenAI {
  if (_llmClient) return _llmClient
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM_API_KEY environment variable is not configured')
  }
  _llmClient = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL,
  })
  return _llmClient
}

/**
 * Returns the lazily-initialized OpenAI client singleton.
 * Validates that LLM_API_KEY is configured on first call.
 *
 * @returns The configured OpenAI client instance.
 * @throws {Error} If LLM_API_KEY environment variable is not set.
 */
export function llmClient(): OpenAI {
  return createLlmClient()
}

function makeToolResult(
  tc: ChatCompletionMessageFunctionToolCall,
  content: string,
): ChatCompletionMessageParam {
  return {
    role: 'tool' as const,
    tool_call_id: tc.id,
    name: tc.function.name,
    content,
  } as ChatCompletionMessageParam
}

/**
 * Runs the agentic tool-call loop: sends messages to the LLM, executes
 * tool calls when the model requests them, feeds results back, and
 * repeats until a final text response is produced.
 *
 * @param config - Configuration for the tool loop.
 * @param config.systemPrompt - System prompt instructing the LLM behavior.
 * @param config.userMessage - The user's current message.
 * @param config.conversationHistory - Previous messages for multi-turn context.
 * @param config.tools - Tool definitions available to the LLM.
 * @param config.executeTool - Callback invoked for each tool call.
 * @param config.maxIterations - Maximum loop iterations (default: 10).
 * @param config.confirmedWriteTools - Tool names the user has explicitly confirmed.
 * @returns The final text response, pending actions, and action results.
 * @throws {Error} If LLM_API_KEY is not configured or max iterations exceeded.
 */
export async function runToolLoop(
  config: RunToolLoopConfig,
): Promise<RunToolLoopResult> {
  const {
    systemPrompt,
    userMessage,
    conversationHistory,
    tools,
    executeTool,
    toolContext,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    confirmedWriteTools = [],
  } = config

  const client = createLlmClient()
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL
  const writeToolNames = new Set(
    tools.filter((t) => t.isWrite).map((t) => t.function.name),
  )
  const confirmedSet = new Set(confirmedWriteTools)

  const sanitizedTools = tools.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ isWrite: _isWrite, ...rest }) => rest,
  )

  const pendingActions: PendingAction[] = []
  const actionResults: ActionResult[] = []

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(
      (msg) =>
        ({
          role: msg.role,
          content: msg.content,
        }) as ChatCompletionMessageParam,
    ),
    { role: 'user', content: userMessage },
  ]

  function stripThoughtTags(text: string): string {
    return text.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim()
  }

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: sanitizedTools.length > 0 ? sanitizedTools : undefined,
      tool_choice: sanitizedTools.length > 0 ? 'auto' : undefined,
    })

    const choice = response.choices[0]
    if (!choice) throw new Error('LLM returned no choices')

    const { message, finish_reason } = choice
    const cleanContent = stripThoughtTags(message.content ?? '')

    logger.debug(
      {
        iteration: i,
        finish_reason,
        hasToolCalls: !!message.tool_calls?.length,
        content: cleanContent.substring(0, 100),
      },
      'LLM response received',
    )

    if (finish_reason === 'stop') {
      // If we have pending actions but AI claims success, ensure confirmation message
      if (pendingActions.length > 0) {
        const confirmationMessage =
          pendingActions.length === 1
            ? `Saya memerlukan konfirmasi Anda untuk melakukan operasi "${pendingActions[0].tool}". Mohon konfirmasi melalui tombol yang tersedia.`
            : `Saya memerlukan konfirmasi Anda untuk melakukan ${pendingActions.length} operasi. Mohon konfirmasi melalui tombol yang tersedia.`
        logger.debug(
          { pendingActions: pendingActions.map((a) => a.tool) },
          'Overriding AI reply with confirmation message',
        )
        return { reply: confirmationMessage, pendingActions, actionResults }
      }

      // If we have action results, log them for debugging
      if (actionResults.length > 0) {
        logger.debug(
          {
            actionResults: actionResults.map((r) => ({
              tool: r.tool,
              success: r.success,
            })),
          },
          'Returning with action results',
        )
      }

      return { reply: cleanContent, pendingActions, actionResults }
    }

    if (finish_reason === 'length') {
      throw new Error('LLM response was truncated (max tokens reached)')
    }

    if (finish_reason !== 'tool_calls' && finish_reason !== 'function_call') {
      return { reply: cleanContent, pendingActions, actionResults }
    }

    const toolCalls =
      message.tool_calls?.filter(
        (tc): tc is ChatCompletionMessageFunctionToolCall =>
          tc.type === 'function',
      ) ?? []

    if (toolCalls.length === 0 && message.function_call) {
      toolCalls.push({
        id: `call_legacy_${Date.now()}`,
        type: 'function',
        function: {
          name: message.function_call.name,
          arguments: message.function_call.arguments,
        },
      })
    }

    if (toolCalls.length === 0) {
      return { reply: message.content ?? '', pendingActions, actionResults }
    }

    messages.push({
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: toolCalls,
    })

    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        let args: Record<string, unknown>
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>
        } catch {
          return makeToolResult(
            tc,
            `Error: Failed to parse tool arguments: ${tc.function.arguments}`,
          )
        }

        const toolName = tc.function.name

        if (writeToolNames.has(toolName) && !confirmedSet.has(toolName)) {
          pendingActions.push({ tool: toolName, args })
          logger.debug(
            { tool: toolName, args },
            'Write tool requires confirmation, adding to pending',
          )
          return makeToolResult(
            tc,
            JSON.stringify({
              success: false,
              pending: true,
              tool: toolName,
              args,
            }),
          )
        }

        try {
          logger.debug({ tool: toolName, args }, 'Executing tool')
          const result = await executeTool(toolName, args, toolContext)
          logger.debug(
            { tool: toolName, result: result.substring(0, 200) },
            'Tool execution completed',
          )
          let parsed: unknown
          try {
            parsed = JSON.parse(result)
          } catch {
            parsed = { success: true, data: result }
          }
          const parsedObj = parsed as Record<string, unknown>
          actionResults.push({
            tool: toolName,
            success: parsedObj.success === true,
            data: parsedObj.data,
            error: parsedObj.error as
              | { code: string; message: string }
              | undefined,
          })
          return makeToolResult(tc, result)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          actionResults.push({
            tool: toolName,
            success: false,
            error: { code: 'INTERNAL_ERROR', message: errorMessage },
          })
          return makeToolResult(tc, `Error: ${errorMessage}`)
        }
      }),
    )

    messages.push(...toolResults)
  }

  throw new Error('Tool loop exceeded maximum iterations')
}
