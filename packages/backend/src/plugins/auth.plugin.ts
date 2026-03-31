import { auth } from '#integrations/auth'
import { prisma } from '#integrations/prisma'
import { Elysia } from 'elysia'
import { logger } from '#libraries/utilities'

type Permission = Record<string, string[]>

async function fetchFullOrganization(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      invitations: true,
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  })
}

async function authenticate(headers: Headers) {
  const apiKey = headers.get('x-api-key')

  if (apiKey) {
    const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
    if (result.valid && result.key) {
      const userId = result.key.metadata?.userId as string | undefined
      const user = userId
        ? await prisma.user.findUnique({ where: { id: userId } })
        : null

      if (user) {
        return {
          type: 'api_key' as const,
          user,
          session: null,
          organizationId: result.key.referenceId,
        }
      }
    }
    return null
  }

  const session = await auth.api.getSession({ headers })
  if (session) {
    return {
      type: 'session' as const,
      user: session.user,
      session: session.session,
      organizationId: null,
    }
  }

  return null
}

export const authPlugin = new Elysia({ name: 'auth' }).macro({
  requireAuth: {
    async resolve({ status, request: { headers, url } }) {
      try {
        const result = await authenticate(headers)
        if (!result) {
          logger.info({ url }, 'requireAuth: no valid auth found')
          return status(401)
        }

        return {
          user: result.user,
          session: result.session,
          _authType: result.type,
        }
      } catch (err) {
        logger.error({ err, url }, 'requireAuth: exception thrown')
        return status(401)
      }
    },
  },
  requireOrg: {
    async resolve({ status, request: { headers, url } }) {
      try {
        const result = await authenticate(headers)
        if (!result) {
          logger.info({ url }, 'requireOrg: no valid auth found')
          return status(401)
        }

        let organization
        if (result.type === 'api_key' && result.organizationId) {
          organization = await fetchFullOrganization(result.organizationId)
        } else {
          organization = await auth.api.getFullOrganization({ headers })
        }

        if (!organization) {
          logger.info({ url }, 'requireOrg: no organization found')
          return status(401)
        }

        return {
          user: result.user,
          session: result.session,
          organization,
          _authType: result.type,
        }
      } catch (err) {
        logger.error({ err, url }, 'requireOrg: exception thrown')
        return status(401)
      }
    },
  },
  requirePermission(permissions: Permission) {
    return {
      async beforeHandle({ request: { headers, url }, status }) {
        const apiKey = headers.get('x-api-key')

        if (apiKey) {
          const result = await auth.api.verifyApiKey({
            body: { key: apiKey, permissions },
          })
          if (!result.valid) return status(403, 'Forbidden')
        } else {
          const hasPerms = await auth.api.hasPermission({
            headers,
            body: { permissions },
          })
          if (!hasPerms) {
            logger.info({ permissions, url }, 'requirePermission: denied')
            return status(403, 'Forbidden')
          }
        }
      },
    }
  },
})
