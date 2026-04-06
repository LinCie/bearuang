import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { auth } from '#integrations/auth'
import { aiService } from './ai.service'
import { logger } from '#libraries/utilities'

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
})

const chatRequestDto = z.object({
  message: z.string().min(1).max(2000),
  messages: z.array(chatMessageSchema).max(20).optional(),
  confirmedWriteTools: z.array(z.string()).optional(),
})

const textResponseSchema = z.object({
  type: z.literal('text'),
  reply: z.string(),
})

const pendingActionSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
})

const confirmationRequiredSchema = z.object({
  type: z.literal('confirmation_required'),
  reply: z.string(),
  pendingActions: z.array(pendingActionSchema),
})

const actionResultSchema = z.object({
  tool: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
})

const actionResultResponseSchema = z.object({
  type: z.literal('action_result'),
  reply: z.string(),
  actionResults: z.array(actionResultSchema),
})

const chatSuccessResponse = z.discriminatedUnion('type', [
  textResponseSchema,
  confirmationRequiredSchema,
  actionResultResponseSchema,
])

const chatErrorResponse = z.object({
  error: z.string(),
})

export const aiRoute = new Elysia({
  prefix: '/ai',
  tags: ['AI'],
})
  .use(authPlugin)
  .post(
    '/chat',
    async ({ organization, user, request, body, status, _authType }) => {
      const member = organization.members.find((m) => m.userId === user.id)
      const userRole = member?.role ?? 'member'

      const checkPermission = async (permission: string) => {
        const [resource, action] = permission.split(':')
        if (!resource || !action) return false
        const result = await auth.api.hasPermission({
          headers: request.headers,
          body: { permissions: { [resource]: [action] } },
        })
        return !!result
      }

      try {
        const result = await aiService.chat({
          userMessage: body.message,
          conversationHistory: body.messages ?? [],
          confirmedWriteTools: body.confirmedWriteTools,
          userId: user.id,
          organizationId: organization.id,
          userRole: Array.isArray(userRole) ? userRole[0] : userRole,
          authType: _authType,
          checkPermission,
        })

        if (result.pendingActions.length > 0) {
          return {
            type: 'confirmation_required',
            reply: result.reply,
            pendingActions: result.pendingActions,
          }
        }

        if (result.actionResults.length > 0) {
          return {
            type: 'action_result',
            reply: result.reply,
            actionResults: result.actionResults,
          }
        }

        return { type: 'text', reply: result.reply }
      } catch (err) {
        logger.error({ err }, 'AI chat error')
        return status(502, { error: 'AI service unavailable' })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      body: chatRequestDto,
      response: {
        200: chatSuccessResponse,
        502: chatErrorResponse,
      },
      detail: {
        summary: 'Chat with AI assistant',
        description:
          'Send a natural language message to the AI assistant for product management. Returns structured responses with confirmation requirements for write operations.',
      },
    },
  )
