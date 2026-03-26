import { prisma } from "@/integrations/prisma";

export interface RoleWithPermissions {
  id: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Converts a flat permission array like ["supplier:create", "supplier:update"]
 * to a grouped JSON object like { "supplier": ["create", "update"] }.
 * This is the format better-auth expects in the OrganizationRole.permission column.
 */
function toPermissionObject(perms: string[]): Record<string, string[]> {
  const obj: Record<string, string[]> = {};
  for (const p of perms) {
    const [resource, action] = p.split(":");
    if (!resource || !action) continue;
    if (!obj[resource]) obj[resource] = [];
    obj[resource].push(action);
  }
  return obj;
}

/**
 * Converts a JSON permission object like { "supplier": ["create", "update"] }
 * to a flat array like ["supplier:create", "supplier:update"].
 */
function toPermissionArray(obj: Record<string, string[]>): string[] {
  const perms: string[] = [];
  for (const [resource, actions] of Object.entries(obj)) {
    for (const action of actions) {
      perms.push(`${resource}:${action}`);
    }
  }
  return perms;
}

/**
 * Parses the permission column value, handling both:
 * - JSON object format: '{"supplier":["create","update"]}'
 * - Legacy flat string format: 'supplier:create'
 */
function parsePermissionColumn(
  value: string,
): Record<string, string[]> {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string[]>;
    }
  } catch {
    // Legacy format: "resource:action"
    const [resource, action] = value.split(":");
    if (resource && action) {
      return { [resource]: [action] };
    }
  }
  return {};
}

export const rolesService = {
  /**
   * List all custom roles for an organization with their aggregated permissions.
   * Stores one row per role with permissions as a JSON object.
   */
  async listRoles(organizationId: string): Promise<RoleWithPermissions[]> {
    const rows = await prisma.organizationRole.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      permissions: toPermissionArray(parsePermissionColumn(row.permission)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null,
    }));
  },

  /**
   * Get a specific custom role with its permissions.
   */
  async getRole(
    organizationId: string,
    role: string,
  ): Promise<RoleWithPermissions | null> {
    const row = await prisma.organizationRole.findFirst({
      where: { organizationId, role },
    });

    if (!row) return null;

    return {
      id: row.id,
      role: row.role,
      permissions: toPermissionArray(parsePermissionColumn(row.permission)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  },

  /**
   * Create a new custom role with permissions.
   * Stores one row per role with permissions as a JSON object,
   * matching the format better-auth expects for dynamic access control.
   */
  async createRole(
    organizationId: string,
    data: { role: string; permissions: string[] },
  ): Promise<RoleWithPermissions> {
    const now = new Date();
    const permissionObj = toPermissionObject(data.permissions);

    await prisma.organizationRole.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        role: data.role,
        permission: JSON.stringify(permissionObj),
        createdAt: now,
      },
    });

    return {
      id: data.role,
      role: data.role,
      permissions: data.permissions,
      createdAt: now.toISOString(),
      updatedAt: null,
    };
  },

  /**
   * Update a custom role's name and/or permissions.
   */
  async updateRole(
    organizationId: string,
    roleName: string,
    data: { role?: string; permissions?: string[] },
  ): Promise<RoleWithPermissions | null> {
    const existing = await prisma.organizationRole.findFirst({
      where: { organizationId, role: roleName },
    });

    if (!existing) return null;

    const now = new Date();

    if (data.permissions !== undefined) {
      const newRole = data.role ?? roleName;
      const permissionObj = toPermissionObject(data.permissions);

      // Delete existing row and create updated one
      await prisma.organizationRole.deleteMany({
        where: { organizationId, role: roleName },
      });

      await prisma.organizationRole.create({
        data: {
          id: crypto.randomUUID(),
          organizationId,
          role: newRole,
          permission: JSON.stringify(permissionObj),
          createdAt: existing.createdAt,
          updatedAt: now,
        },
      });

      return {
        id: newRole,
        role: newRole,
        permissions: data.permissions,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    // Only update role name
    if (data.role) {
      await prisma.organizationRole.updateMany({
        where: { organizationId, role: roleName },
        data: { role: data.role, updatedAt: now },
      });

      const updated = await prisma.organizationRole.findFirst({
        where: { organizationId, role: data.role },
      });

      return {
        id: data.role,
        role: data.role,
        permissions: updated
          ? toPermissionArray(parsePermissionColumn(updated.permission))
          : [],
        createdAt: existing.createdAt.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    // No changes
    return {
      id: roleName,
      role: roleName,
      permissions: toPermissionArray(parsePermissionColumn(existing.permission)),
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt?.toISOString() ?? null,
    };
  },

  /**
   * Delete a custom role and all its permissions.
   */
  async deleteRole(
    organizationId: string,
    roleName: string,
  ): Promise<boolean> {
    const result = await prisma.organizationRole.deleteMany({
      where: { organizationId, role: roleName },
    });
    return result.count > 0;
  },
};
