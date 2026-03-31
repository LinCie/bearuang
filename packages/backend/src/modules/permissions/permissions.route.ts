import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { auth } from '#integrations/auth'
import { prisma } from '#integrations/prisma'
import {
  permissionResources,
  permissionActions,
  isSystemRole,
} from '#libraries/permissions'

const permissionsResponse = z.object({
  viewResources: z.array(z.string()),
  permissions: z.array(z.string()),
})

/**
 * Parses a permission column value into resource:action pairs.
 * Handles both JSON object format '{"supplier":["create","update"]}'
 * and legacy flat string format 'supplier:create'.
 */
function parsePermissionString(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const perms: string[] = []
      for (const [resource, actions] of Object.entries(parsed)) {
        if (Array.isArray(actions)) {
          for (const action of actions) {
            perms.push(`${resource}:${action}`)
          }
        }
      }
      return perms
    }
  } catch {
    // Legacy format: "resource:action"
    if (value.includes(':')) return [value]
  }
  return []
}

/**
 * Builds the full permission string list for system roles.
 * Returns all resource:action combinations defined in the permission statement.
 */
function getAllSystemPermissions(): string[] {
  const perms: string[] = []
  for (const resource of permissionResources) {
    const actions = permissionActions[resource]
    if (actions) {
      for (const action of actions) {
        perms.push(`${resource}:${action}`)
      }
    }
  }
  return perms
}

export const permissionsRoute = new Elysia({
  prefix: '/permissions',
  tags: ['Permissions'],
})
  .use(authPlugin)
  .get(
    '/',
    async ({ request: { headers }, user }) => {
      const org = await auth.api.getFullOrganization({ headers })
      if (!org) return { viewResources: [], permissions: [] }

      const member = org.members?.find(
        (m: { userId: string }) => m.userId === user.id,
      )
      const role = member?.role ?? ''

      // System roles have all permissions defined in the statement
      if (isSystemRole(role)) {
        const allPerms = getAllSystemPermissions()
        return {
          viewResources: [...permissionResources],
          permissions: allPerms,
        }
      }

      // Custom roles: query OrganizationRole table for permission entries
      const rolePerms = await prisma.organizationRole.findMany({
        where: { organizationId: org.id, role },
        select: { permission: true },
      })

      // Parse all permission strings from the role
      const allPerms = new Set<string>()
      for (const rp of rolePerms) {
        for (const perm of parsePermissionString(rp.permission)) {
          allPerms.add(perm)
        }
      }

      // Extract unique resource names for viewResources
      const viewResources = new Set<string>()
      for (const perm of allPerms) {
        viewResources.add(perm.split(':')[0])
      }

      return {
        viewResources: [...viewResources],
        permissions: [...allPerms],
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: permissionsResponse,
      },
      detail: {
        summary: "Get current user's permissions",
        description:
          'Returns the list of resources the current user can view and all specific permission strings (resource:action) for the active organization.',
      },
    },
  )
