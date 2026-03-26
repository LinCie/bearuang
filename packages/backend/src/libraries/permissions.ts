import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  product: ["create", "update", "delete"],
  productVariant: ["create", "update", "delete"],
  warehouse: ["create", "update", "delete"],
  supplier: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  purchaseOrder: ["create", "update", "delete", "receive"],
  purchaseOrderItem: ["create", "update", "delete"],
  salesOrder: ["create", "update", "delete", "fulfill"],
  salesOrderItem: ["create", "update", "delete"],
  stock: ["adjust", "view"],
  apiKey: ["create", "read", "update", "delete"],
  invitation: ["create", "delete"],
  member: ["update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  ...ownerAc.statements,
  product: ["create", "update", "delete"],
  productVariant: ["create", "update", "delete"],
  warehouse: ["create", "update", "delete"],
  supplier: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  purchaseOrder: ["create", "update", "delete", "receive"],
  purchaseOrderItem: ["create", "update", "delete"],
  salesOrder: ["create", "update", "delete", "fulfill"],
  salesOrderItem: ["create", "update", "delete"],
  stock: ["adjust", "view"],
  apiKey: ["create", "read", "update", "delete"],
  invitation: ["create", "delete"],
  member: ["update", "delete"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  product: ["create", "update", "delete"],
  productVariant: ["create", "update", "delete"],
  warehouse: ["create", "update", "delete"],
  supplier: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  purchaseOrder: ["create", "update", "delete", "receive"],
  purchaseOrderItem: ["create", "update", "delete"],
  salesOrder: ["create", "update", "delete", "fulfill"],
  salesOrderItem: ["create", "update", "delete"],
  stock: ["adjust", "view"],
  apiKey: ["create", "read", "update", "delete"],
  invitation: ["create", "delete"],
  member: ["update", "delete"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  product: [],
  productVariant: [],
  warehouse: [],
  supplier: [],
  customer: ["create", "update"],
  purchaseOrder: ["create"],
  purchaseOrderItem: [],
  salesOrder: ["create"],
  salesOrderItem: [],
  stock: [],
  apiKey: ["read"],
  invitation: [],
  member: [],
});

export type PermissionStatement = typeof statement;

// ─── Available Permissions for Dynamic Roles ──────────────────

export const permissionResources = [
  "product",
  "productVariant",
  "warehouse",
  "supplier",
  "customer",
  "purchaseOrder",
  "purchaseOrderItem",
  "salesOrder",
  "salesOrderItem",
  "stock",
  "apiKey",
  "invitation",
  "member",
] as const;

export const permissionActions: Record<
  string,
  readonly string[]
> = {
  product: ["create", "update", "delete"],
  productVariant: ["create", "update", "delete"],
  warehouse: ["create", "update", "delete"],
  supplier: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  purchaseOrder: ["create", "update", "delete", "receive"],
  purchaseOrderItem: ["create", "update", "delete"],
  salesOrder: ["create", "update", "delete", "fulfill"],
  salesOrderItem: ["create", "update", "delete"],
  stock: ["adjust", "view"],
  apiKey: ["create", "read", "update", "delete"],
  invitation: ["create", "delete"],
  member: ["update", "delete"],
};

/**
 * Permission string format: "resource:action"
 * Example: "product:create", "stock:view"
 */
export type PermissionString = `${(typeof permissionResources)[number]}:${string}`;

/**
 * Generates all valid permission strings from the statement definition.
 */
export function getAllPermissions(): PermissionString[] {
  const permissions: PermissionString[] = [];
  for (const [resource, actions] of Object.entries(permissionActions)) {
    for (const action of actions) {
      permissions.push(`${resource}:${action}` as PermissionString);
    }
  }
  return permissions;
}

/**
 * Validates that a permission string is valid.
 */
export function isValidPermission(
  permission: string,
): permission is PermissionString {
  const [resource, action] = permission.split(":");
  if (!resource || !action) return false;
  const actions = permissionActions[resource];
  if (!actions) return false;
  return (actions as readonly string[]).includes(action);
}

// System roles that cannot be modified or deleted
export const systemRoles = ["owner", "admin", "member"] as const;

export function isSystemRole(role: string): boolean {
  return (systemRoles as readonly string[]).includes(role);
}
