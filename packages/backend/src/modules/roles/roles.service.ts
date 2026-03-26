import { prisma } from "@/integrations/prisma";

export interface RoleWithPermissions {
  id: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string | null;
}

export const rolesService = {
  /**
   * List all custom roles for an organization with their aggregated permissions.
   */
  async listRoles(organizationId: string): Promise<RoleWithPermissions[]> {
    const rows = await prisma.organizationRole.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate permissions by role name
    const roleMap = new Map<string, RoleWithPermissions>();
    for (const row of rows) {
      const existing = roleMap.get(row.role);
      if (existing) {
        existing.permissions.push(row.permission);
        // Use earliest createdAt, latest updatedAt
        if (row.createdAt < new Date(existing.createdAt)) {
          existing.createdAt = row.createdAt.toISOString();
        }
        if (
          row.updatedAt &&
          (!existing.updatedAt ||
            row.updatedAt > new Date(existing.updatedAt))
        ) {
          existing.updatedAt = row.updatedAt.toISOString();
        }
      } else {
        roleMap.set(row.role, {
          id: row.id,
          role: row.role,
          permissions: [row.permission],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt?.toISOString() ?? null,
        });
      }
    }

    return Array.from(roleMap.values());
  },

  /**
   * Get a specific custom role with its permissions.
   */
  async getRole(
    organizationId: string,
    role: string,
  ): Promise<RoleWithPermissions | null> {
    const rows = await prisma.organizationRole.findMany({
      where: { organizationId, role },
    });

    if (rows.length === 0) return null;

    const first = rows[0];
    return {
      id: first.role, // Use role name as identifier
      role: first.role,
      permissions: rows.map((r) => r.permission),
      createdAt: first.createdAt.toISOString(),
      updatedAt: first.updatedAt?.toISOString() ?? null,
    };
  },

  /**
   * Create a new custom role with permissions.
   * Each permission is stored as a separate row with a unique ID.
   * We use the role name as the grouping mechanism.
   */
  async createRole(
    organizationId: string,
    data: { role: string; permissions: string[] },
  ): Promise<RoleWithPermissions> {
    const now = new Date();

    await prisma.$transaction(
      data.permissions.map((permission) =>
        prisma.organizationRole.create({
          data: {
            id: crypto.randomUUID(),
            organizationId,
            role: data.role,
            permission,
            createdAt: now,
          },
        }),
      ),
    );

    return {
      id: data.role, // Use role name as identifier for grouping
      role: data.role,
      permissions: data.permissions,
      createdAt: now.toISOString(),
      updatedAt: null,
    };
  },

  /**
   * Update a custom role's name and/or permissions.
   * Deletes old permissions and creates new ones.
   */
  async updateRole(
    organizationId: string,
    roleName: string,
    data: { role?: string; permissions?: string[] },
  ): Promise<RoleWithPermissions | null> {
    const existingRows = await prisma.organizationRole.findMany({
      where: { organizationId, role: roleName },
    });

    if (existingRows.length === 0) return null;

    const first = existingRows[0];
    const now = new Date();

    if (data.permissions !== undefined) {
      // Delete existing permissions for this role and recreate
      await prisma.organizationRole.deleteMany({
        where: { organizationId, role: roleName },
      });

      const newRole = data.role ?? roleName;

      await prisma.$transaction(
        data.permissions.map((permission) =>
          prisma.organizationRole.create({
            data: {
              id: crypto.randomUUID(),
              organizationId,
              role: newRole,
              permission,
              createdAt: first.createdAt,
              updatedAt: now,
            },
          }),
        ),
      );

      return {
        id: newRole,
        role: newRole,
        permissions: data.permissions,
        createdAt: first.createdAt.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    // Only update role name
    if (data.role) {
      await prisma.organizationRole.updateMany({
        where: { organizationId, role: roleName },
        data: { role: data.role, updatedAt: now },
      });

      const rows = await prisma.organizationRole.findMany({
        where: { organizationId, role: data.role },
      });

      return {
        id: data.role,
        role: data.role,
        permissions: rows.map((r) => r.permission),
        createdAt: first.createdAt.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    // No changes
    return {
      id: roleName,
      role: roleName,
      permissions: existingRows.map((r) => r.permission),
      createdAt: first.createdAt.toISOString(),
      updatedAt: first.updatedAt?.toISOString() ?? null,
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
