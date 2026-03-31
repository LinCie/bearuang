import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { rolesService } from './roles.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  isSystemRole,
  isValidPermission,
  getAllPermissions,
  permissionResources,
  permissionActions,
} from '#libraries/permissions'

// ─── Schemas ──────────────────────────────────────────────────

export const roleSchema = z.object({
  id: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
})

export const createRoleDto = z.object({
  role: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name too long')
    .refine((val) => !isSystemRole(val), {
      message: 'Cannot create a system role',
    }),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .refine((perms) => perms.every((p) => isValidPermission(p)), {
      message: 'Invalid permission format',
    }),
})

export const updateRoleDto = z.object({
  role: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name too long')
    .refine((val) => !isSystemRole(val), {
      message: 'Cannot rename to a system role',
    })
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .refine((perms) => perms.every((p) => isValidPermission(p)), {
      message: 'Invalid permission format',
    })
    .optional(),
})

export const roleIdParam = z.object({
  id: z.string(),
})

export const availablePermissionsSchema = z.object({
  resources: z.array(z.string()),
  actions: z.record(z.string(), z.array(z.string())),
  permissions: z.array(z.string()),
})

export type Role = z.infer<typeof roleSchema>
export type CreateRoleInput = z.infer<typeof createRoleDto>
export type UpdateRoleInput = z.infer<typeof updateRoleDto>

// ─── Route ────────────────────────────────────────────────────

export const rolesRoute = new Elysia({
  prefix: '/roles',
  tags: ['Roles'],
})
  .use(authPlugin)
  .get(
    '/available-permissions',
    () => {
      return {
        resources: [...permissionResources],
        actions: Object.fromEntries(
          Object.entries(permissionActions).map(([k, v]) => [k, [...v]]),
        ),
        permissions: getAllPermissions(),
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: availablePermissionsSchema,
      },
      detail: {
        summary: 'List available permissions',
        description:
          'Returns all available permission resources, actions, and permission strings for creating custom roles.',
      },
    },
  )
  .get(
    '/',
    async ({ organization }) => {
      const roles = await rolesService.listRoles(organization.id)
      return roles
    },
    {
      requireAuth: true,
      requireOrg: true,
      response: {
        200: z.array(roleSchema),
      },
      detail: {
        summary: 'List custom roles',
        description:
          'Returns all custom roles with their permissions for the authenticated organization.',
      },
    },
  )
  .get(
    '/:id',
    async ({ organization, params, status }) => {
      const role = await rolesService.getRole(organization.id, params.id)
      if (!role) return status(404, { message: 'Role not found' })
      return role
    },
    {
      requireAuth: true,
      requireOrg: true,
      params: roleIdParam,
      response: {
        200: roleSchema,
        404: errorResponse,
      },
      detail: {
        summary: 'Get a role',
        description: 'Retrieves a specific custom role by its ID.',
      },
    },
  )
  .post(
    '/',
    async ({ _authType, organization, user, body, status }) => {
      try {
        const role = await rolesService.createRole(organization.id, body)
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Role',
          operation: 'create',
          args: { data: body },
        })
        return status(201, role)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create role'
        return status(400, { message })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { member: ['update'] },
      body: createRoleDto,
      response: {
        201: roleSchema,
        400: errorResponse,
      },
      detail: {
        summary: 'Create a custom role',
        description:
          'Creates a new custom role with specified permissions. Requires owner/admin permission.',
      },
    },
  )
  .patch(
    '/:id',
    async ({ _authType, organization, user, params, body, status }) => {
      // Prevent modifying system roles
      const existing = await rolesService.getRole(organization.id, params.id)
      if (!existing) return status(404, { message: 'Role not found' })
      if (isSystemRole(existing.role)) {
        return status(400, { message: 'Cannot modify a system role' })
      }

      try {
        const role = await rolesService.updateRole(
          organization.id,
          params.id,
          body,
        )
        if (!role) return status(404, { message: 'Role not found' })
        void logAudit({
          organizationId: organization.id,
          userId: user.id,
          authType: _authType,
          model: 'Role',
          operation: 'update',
          args: { id: params.id, data: body },
        })
        return role
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update role'
        return status(400, { message })
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { member: ['update'] },
      params: roleIdParam,
      body: updateRoleDto,
      response: {
        200: roleSchema,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Update a custom role',
        description:
          "Updates an existing custom role's name and/or permissions. System roles cannot be modified.",
      },
    },
  )
  .delete(
    '/:id',
    async ({ _authType, organization, user, params, status }) => {
      // Prevent deleting system roles
      const existing = await rolesService.getRole(organization.id, params.id)
      if (!existing) return status(404, { message: 'Role not found' })
      if (isSystemRole(existing.role)) {
        return status(400, { message: 'Cannot delete a system role' })
      }

      const deleted = await rolesService.deleteRole(organization.id, params.id)
      if (!deleted) return status(404, { message: 'Role not found' })
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Role',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Role deleted' })
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { member: ['update'] },
      params: roleIdParam,
      response: {
        200: errorResponse,
        400: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: 'Delete a custom role',
        description:
          'Deletes a custom role and all its permissions. System roles cannot be deleted.',
      },
    },
  )
