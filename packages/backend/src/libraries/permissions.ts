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
});

export type PermissionStatement = typeof statement;
