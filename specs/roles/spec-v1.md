---
title: Custom Roles Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: roles
tags: [roles, permissions, rbac, dynamic-roles, elysia, prisma, react, tanstack, better-auth]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the custom roles domain in BearUang. It covers the **Custom Roles** resource — a dynamic role-based access control (RBAC) system that allows organizations to create roles with configurable permission arrays. This spec serves as a reference for building and modifying the roles module.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer, Prisma model (`OrganizationRole`), and permission format conversion
- **Frontend module structure**: TanStack Query hooks, React components (role form sheet, role management sheet), and permission matrix UI
- **API contracts**: HTTP endpoints (list, create, update, delete), request/response schemas, error handling, system role protection
- **Permission model**: Flat permission arrays, resource/action definitions, validation, conversion to grouped JSON for better-auth compatibility
- **Conventions**: system role immutability, permission format conversion, audit logging, Indonesian UI text

**Audience**: Developers building or modifying the custom roles domain and related permission-gated features.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, better-auth access control, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Custom Role** | A user-defined role with a name and a configurable array of permission strings, stored in the `OrganizationRole` table |
| **System Role** | A built-in role (`owner`, `admin`, `member`) that cannot be created, modified, or deleted via the custom roles API |
| **Permission String** | A string in `{resource}:{action}` format (e.g., `product:create`, `stock:adjust`) that grants a specific capability |
| **Permission Object** | A JSON object in `{ resource: ["action1", "action2"] }` format that better-auth expects in the `OrganizationRole.permission` column |
| **Resource** | A domain entity that can be acted upon (e.g., `product`, `supplier`, `purchaseOrder`) |
| **Action** | An operation that can be performed on a resource (e.g., `create`, `update`, `delete`, `view`, `receive`, `fulfill`, `adjust`, `read`) |
| **Access Control** | The `better-auth/plugins/access` system that defines permission statements, default roles, and validates permissions at the middleware level |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for role create/edit forms and role management |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for the roles resource |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The roles module resides in `packages/backend/src/modules/roles/` with `roles.route.ts` and `roles.service.ts`
- **REQ-002**: The route plugin is an Elysia instance with `{ prefix: '/roles', tags: ['Roles'] }`
- **REQ-003**: The route plugin must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Write endpoints (create, update, delete) require `requirePermission: { member: ['update'] }` — only users who can manage members can manage roles
- **REQ-006**: Zod schemas define request validation (body, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: All Date fields from Prisma are serialized to ISO strings via `toISOString()` in the service layer
- **REQ-009**: System roles (`owner`, `admin`, `member`) cannot be created, modified, or deleted — enforced via `isSystemRole()` check in both Zod validation and route handlers
- **REQ-010**: All write operations call `void logAudit(...)` with `model: 'Role'`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-013**: System role modification/deletion attempts return `400` with a descriptive message

### 3.2 Service Layer

- **REQ-014**: The service is exported as an object literal: `export const rolesService = { async method() {...} }`
- **REQ-015**: The service converts between flat permission arrays (`["supplier:create", "supplier:update"]`) and grouped permission objects (`{ "supplier": ["create", "update"] }`) for better-auth compatibility
- **REQ-016**: The `toPermissionObject()` function converts flat arrays to grouped JSON; `toPermissionArray()` converts grouped JSON back to flat arrays
- **REQ-017**: The `parsePermissionColumn()` function handles both JSON object format and legacy flat string format when reading from the database
- **REQ-018**: Role updates that change permissions perform a delete-then-recreate pattern (delete old row, create new row with updated `permission` JSON) to ensure clean permission replacement
- **REQ-019**: Role updates that only change the name use `updateMany` for an in-place update
- **REQ-020**: All queries are scoped by `organizationId`

### 3.3 Permission Model

- **REQ-021**: Permission strings follow the format `{resource}:{action}` (e.g., `product:create`, `stock:adjust`)
- **REQ-022**: Valid resources are defined in `permissionResources` array: `product`, `productCategory`, `productVariant`, `warehouse`, `supplier`, `customer`, `purchaseOrder`, `purchaseOrderItem`, `salesOrder`, `salesOrderItem`, `stock`, `apiKey`, `invitation`, `member`, `media`, `auditLog`
- **REQ-023**: Valid actions per resource are defined in `permissionActions` record — most resources support `create`, `update`, `delete`, `view`; some have additional actions (`receive` for purchaseOrder, `fulfill` for salesOrder, `adjust` for stock, `read` for apiKey)
- **REQ-024**: `isValidPermission()` validates a permission string by splitting on `:` and checking against `permissionActions`
- **REQ-025**: `getAllPermissions()` generates all valid permission strings from the statement definition
- **REQ-026**: The access control instance (`ac`) is created with `createAccessControl(statement)` from better-auth
- **REQ-027**: Three system roles are defined (`owner`, `admin`, `member`) via `ac.newRole()` with fixed permission sets
- **REQ-028**: Zod validation for role creation/update refines the permissions array with `isValidPermission()` — invalid permission strings are rejected at the schema level

### 3.4 Frontend Architecture

- **REQ-029**: The roles module resides in `packages/frontend/src/modules/roles/` with `hooks/`, `components/`, and `index.ts`
- **REQ-030**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-roles.ts`
- **REQ-031**: Query key factories are defined in `hooks/use-roles.ts` as the `roleKeys` hierarchical object
- **REQ-032**: Cache invalidation must target the correct query key scope after mutations
- **REQ-033**: The `RoleFormSheet` component provides a slide-over form with a role name input and a permission matrix UI (resource groups with toggle-all, individual action checkboxes)
- **REQ-034**: The `RoleManagementSheet` component provides a list of custom roles with edit/delete actions, a create button, and a delete confirmation dialog
- **REQ-035**: The permission matrix UI groups permissions by resource with a resource-level toggle (select all/deselect all) and individual action checkboxes with indeterminate state support
- **REQ-036**: Permission-gated UI via `useHasPermission('member:update')` — only users who can manage members see the create/edit buttons
- **REQ-037**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-038**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-lg`)
- **REQ-039**: Delete confirmations use shadcn `Dialog`
- **REQ-040**: All UI text is in Indonesian (Bahasa Indonesia)

### 3.5 Database

- **REQ-041**: The `OrganizationRole` model is managed by better-auth but extended by the roles module for custom role storage
- **REQ-042**: The `OrganizationRole` model uses string primary key (`id`), not UUID v7 — compatible with better-auth's schema
- **REQ-043**: The `permission` column stores a JSON string in `{ "resource": ["action1", "action2"] }` format
- **REQ-044**: The model has an `organizationId` foreign key to `Organization` with `onDelete: Cascade`
- **REQ-045**: Custom roles do not use soft delete — they are permanently deleted from the database

### 3.6 Constraints

- **CON-001**: The `OrganizationRole` table is shared between better-auth system roles and custom roles — system roles cannot be modified via the custom roles API
- **CON-002**: The `permission` column format must be JSON object (not flat array) for better-auth compatibility — the service layer handles conversion
- **CON-003**: Role IDs returned from the API use the `role` name as the `id` field (not the database primary key) — this is how the route identifies roles for get/update/delete operations
- **CON-004**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-005**: The roles module does not have pagination — all custom roles for an organization are returned in a single array
- **CON-006**: The roles module does not have soft delete or trashed/restore endpoints
- **CON-007**: The `api.roles['available-permissions'].get()` Eden client call requires bracket notation for the hyphenated path segment

### 3.7 Guidelines

- **GUD-001**: Co-locate query keys and hooks in a single file (`use-roles.ts`) since the roles module is small
- **GUD-002**: Validate system role protection at both the Zod schema level (refine) and the route handler level (defensive check) for defense in depth
- **GUD-003**: Use `useHasPermission('member:update')` on the frontend to gate role management UI elements
- **GUD-004**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-005**: Use Indonesian labels for resources and actions in the permission matrix UI (`resourceLabels`, `actionLabels` maps)

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/roles/available-permissions` | List all available permission resources, actions, and permission strings | Auth + Org | `{ resources: string[], actions: Record<string, string[]>, permissions: string[] }` |
| GET | `/roles` | List all custom roles for the organization | Auth + Org | `Role[]` |
| GET | `/roles/:id` | Get a specific custom role by ID (role name) | Auth + Org | `Role` or `404` |
| POST | `/roles` | Create a new custom role with permissions | `member:update` | `201 Role` or `400` |
| PATCH | `/roles/:id` | Update a custom role's name and/or permissions | `member:update` | `Role` or `400` or `404` |
| DELETE | `/roles/:id` | Delete a custom role and its permissions | `member:update` | `{ message }` or `400` or `404` |

### 4.2 Response Shapes

```typescript
interface Role {
  id: string;                // Role name used as identifier
  role: string;              // Role name
  permissions: string[];     // Flat permission array: ["product:create", "supplier:view", ...]
  createdAt: string;         // ISO 8601 datetime
  updatedAt: string | null;  // ISO 8601 datetime or null
}

interface AvailablePermissions {
  resources: string[];                         // ["product", "supplier", "stock", ...]
  actions: Record<string, string[]>;           // { "product": ["create", "update", ...], ... }
  permissions: string[];                       // ["product:create", "product:update", ...]
}

interface ErrorResponse {
  message: string;
}
```

### 4.3 Zod Schema Definitions

#### Role Response

```typescript
const roleSchema = z.object({
  id: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
});
```

#### Create Role DTO

```typescript
const createRoleDto = z.object({
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
});
```

#### Update Role DTO

```typescript
const updateRoleDto = z.object({
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
});
```

#### Available Permissions Response

```typescript
const availablePermissionsSchema = z.object({
  resources: z.array(z.string()),
  actions: z.record(z.string(), z.array(z.string())),
  permissions: z.array(z.string()),
});
```

#### Params

```typescript
const roleIdParam = z.object({
  id: z.string(),  // Role name used as ID
});
```

### 4.4 Prisma Model

```prisma
model OrganizationRole {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           String
  permission     String       // JSON string: '{"product":["create","update"],"stock":["view"]}'
  createdAt      DateTime     @default(now())
  updatedAt      DateTime?    @updatedAt

  @@index([organizationId])
  @@index([role])
  @@map("organizationRole")
}
```

### 4.5 Permission Format Conversion

The service layer converts between the flat permission array format (used in API requests/responses) and the grouped JSON object format (required by better-auth in the database).

**Flat to Grouped** (`toPermissionObject`):
```typescript
// Input:  ["supplier:create", "supplier:update", "stock:view"]
// Output: { "supplier": ["create", "update"], "stock": ["view"] }
function toPermissionObject(perms: string[]): Record<string, string[]> {
  const obj: Record<string, string[]> = {};
  for (const p of perms) {
    const [resource, action] = p.split(':');
    if (!resource || !action) continue;
    if (!obj[resource]) obj[resource] = [];
    obj[resource].push(action);
  }
  return obj;
}
```

**Grouped to Flat** (`toPermissionArray`):
```typescript
// Input:  { "supplier": ["create", "update"], "stock": ["view"] }
// Output: ["supplier:create", "supplier:update", "stock:view"]
function toPermissionArray(obj: Record<string, string[]>): string[] {
  const perms: string[] = [];
  for (const [resource, actions] of Object.entries(obj)) {
    for (const action of actions) {
      perms.push(`${resource}:${action}`);
    }
  }
  return perms;
}
```

**Legacy Format Handling** (`parsePermissionColumn`):
```typescript
// Handles both:
// - JSON object format: '{"supplier":["create","update"]}'
// - Legacy flat string format: 'supplier:create'
function parsePermissionColumn(value: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string[]>;
    }
  } catch {
    const [resource, action] = value.split(':');
    if (resource && action) {
      return { [resource]: [action] };
    }
  }
  return {};
}
```

### 4.6 Permission Resources & Actions

```typescript
// All available resources
permissionResources = [
  'product', 'productCategory', 'productVariant', 'warehouse', 'supplier',
  'customer', 'purchaseOrder', 'purchaseOrderItem', 'salesOrder',
  'salesOrderItem', 'stock', 'apiKey', 'invitation', 'member', 'media', 'auditLog',
];

// Actions per resource
permissionActions = {
  product:              ['create', 'update', 'delete', 'view'],
  productCategory:      ['create', 'update', 'delete', 'view'],
  productVariant:       ['create', 'update', 'delete', 'view'],
  warehouse:            ['create', 'update', 'delete', 'view'],
  supplier:             ['create', 'update', 'delete', 'view'],
  customer:             ['create', 'update', 'delete', 'view'],
  purchaseOrder:        ['create', 'update', 'delete', 'receive', 'view'],
  purchaseOrderItem:    ['create', 'update', 'delete', 'view'],
  salesOrder:           ['create', 'update', 'delete', 'fulfill', 'view'],
  salesOrderItem:       ['create', 'update', 'delete', 'view'],
  stock:                ['adjust', 'view'],
  apiKey:               ['create', 'read', 'update', 'delete', 'view'],
  invitation:           ['create', 'delete', 'view'],
  member:               ['update', 'delete', 'view'],
  media:                ['create', 'delete', 'view'],
  auditLog:             ['view'],
};

// System roles (immutable)
systemRoles = ['owner', 'admin', 'member'];
```

### 4.7 System Role Definitions

System roles are defined via `ac.newRole()` in the permissions library. They have fixed permission sets that cannot be modified through the custom roles API.

| Role | Description | Key Differences |
|------|-------------|-----------------|
| **owner** | Full access to all resources and actions | All permissions granted |
| **admin** | Full access to all resources and actions | All permissions granted (same as owner) |
| **member** | Limited read-only access with selective write permissions | `customer: create/update`, `purchaseOrder: create`, `salesOrder: create`, `media: create`, `apiKey: read` |

### 4.8 Frontend Query Key Factories

```typescript
// hooks/use-roles.ts
export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: () => [...roleKeys.lists()] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  available: () => [...roleKeys.all, 'available'] as const,
};
```

### 4.9 Frontend Cache Invalidation Patterns

```typescript
// After creating a role:
queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After updating a role:
queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.id) });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After deleting a role:
queryClient.invalidateQueries({ queryKey: roleKeys.all });  // Invalidates all role queries
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
```

### 4.10 Frontend Hook Types

```typescript
interface Role {
  id: string;
  role: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface CreateRoleInput {
  role: string;
  permissions: string[];
}

interface UpdateRoleInput {
  role?: string;
  permissions?: string[];
}

interface AvailablePermissions {
  resources: string[];
  actions: Record<string, string[]>;
  permissions: string[];
}
```

### 4.11 Frontend Component Structure

```
modules/roles/
  index.ts                           # Barrel export: hooks + components
  hooks/
    index.ts                         # Barrel export: use-roles
    use-roles.ts                     # Query keys, types, all query + mutation hooks
  components/
    index.ts                         # Barrel export: role-form-sheet, role-management-sheet
    role-form-sheet.tsx              # Sheet form: role name, permission matrix with resource groups
    role-management-sheet.tsx        # Sheet: role list, create/edit/delete actions, delete dialog
```

### 4.12 Frontend Component Details

#### RoleFormSheet

A shadcn `Sheet` (slide-over, `sm:max-w-lg`, right side) containing a TanStack Form with:

- **Role name field**: Text input with label "Nama Peran", placeholder "Contoh: Manajer Gudang", validated with `z.string().trim().min(1).max(50)`
- **Permission matrix UI**: Grouped by resource, each group has:
  - Resource-level toggle button (checkbox with check/minus/empty states for all/indeterminate/none)
  - Individual action checkboxes per resource
  - Permission count badge (e.g., "3/4")
  - "Pilih Semua" (select all) and "Hapus Semua" (clear all) buttons
- **Submit behavior**: Calls `onSubmit` callback with `{ role, permissions }`, resets form on success, displays server errors
- **Props**: `open`, `onOpenChange`, `onSubmit`, `isPending`, `editingRole` (for edit mode)
- **Titles**: "Buat Peran Baru" (create) / "Ubah Peran" (edit)

#### RoleManagementSheet

A shadcn `Sheet` (slide-over, `sm:max-w-lg`, right side) containing:

- **Create button**: "Buat Peran Baru" (gated by `useHasPermission('member:update')`)
- **Role list**: Each role card shows:
  - Shield icon with purple styling
  - Role name and permission count
  - Permission summary badges grouped by resource (purple pill badges with resource label and action count)
  - Edit button (pencil icon, gated by `member:update` permission)
  - Delete button (trash icon, always visible)
- **Empty state**: Shield icon, "Belum ada peran kustom" heading, descriptive text
- **Loading state**: Centered spinner
- **Nested components**: Opens `RoleFormSheet` for create/edit, opens `Dialog` for delete confirmation
- **Delete dialog**: "Hapus peran?" title, warning about members losing permissions, "Batalkan" / "Ya, Hapus Peran" buttons

#### Indonesian Labels

```typescript
const resourceLabels: Record<string, string> = {
  product: 'Produk',
  productVariant: 'Varian Produk',
  warehouse: 'Gudang',
  supplier: 'Pemasok',
  customer: 'Pelanggan',
  purchaseOrder: 'Pesanan Pembelian',
  purchaseOrderItem: 'Item Pesanan Pembelian',
  salesOrder: 'Pesanan Penjualan',
  salesOrderItem: 'Item Pesanan Penjualan',
  stock: 'Stok',
  apiKey: 'Kunci API',
  invitation: 'Undangan',
  member: 'Anggota',
};

const actionLabels: Record<string, string> = {
  create: 'Buat',
  update: 'Ubah',
  delete: 'Hapus',
  read: 'Lihat',
  receive: 'Terima',
  fulfill: 'Penuhi',
  adjust: 'Sesuaikan',
  view: 'Lihat',
};
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user in an organization, When they `GET /roles`, Then they receive an array of all custom roles for their organization with flat permission arrays and ISO date strings
- **AC-002**: Given an authenticated user with `member:update` permission, When they `POST /roles` with a valid role name and permission array, Then the role is created (201) and an audit log entry is written
- **AC-003**: Given an authenticated user with `member:update` permission, When they `POST /roles` with a role name matching a system role (`owner`, `admin`, `member`), Then a `400` is returned with "Cannot create a system role"
- **AC-004**: Given an authenticated user with `member:update` permission, When they `PATCH /roles/:id` on a system role, Then a `400` is returned with "Cannot modify a system role"
- **AC-005**: Given an authenticated user with `member:update` permission, When they `DELETE /roles/:id` on a system role, Then a `400` is returned with "Cannot delete a system role"
- **AC-006**: Given an authenticated user with `member:update` permission, When they `POST /roles` with an invalid permission string (e.g., `invalid:action`), Then a `400` is returned with "Invalid permission format"
- **AC-007**: Given an authenticated user, When they `GET /roles/available-permissions`, Then they receive the full list of resources, actions per resource, and all valid permission strings
- **AC-008**: Given an authenticated user, When they `GET /roles/:id` with a non-existent role ID, Then a `404` is returned with "Role not found"
- **AC-009**: Given the frontend `RoleFormSheet`, When a user toggles a resource-level checkbox, Then all action checkboxes for that resource are selected/deselected, with indeterminate state when partially selected
- **AC-010**: Given the frontend `RoleManagementSheet`, When a user without `member:update` permission views the sheet, Then the "Buat Peran Baru" button and edit buttons are hidden
- **AC-011**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-012**: Given a user without an active organization, When any endpoint is called, Then a `403 Forbidden` is returned

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods (permission conversion, CRUD), integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `roles.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Use `prisma.$transaction` with rollback for isolated test data
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404, 400 for system roles), permission validation, permission format conversion (`toPermissionObject`, `toPermissionArray`, `parsePermissionColumn`)
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test components with `render` + mock API responses; test permission matrix toggle logic

## 7. Rationale & Context

### Why Dynamic RBAC Instead of Fixed Roles?

BearUang targets businesses of varying sizes and complexity. Fixed roles (`owner`, `admin`, `member`) are too rigid for organizations that need fine-grained access control — e.g., a "Warehouse Manager" who can manage stock and view products but not create sales orders. Dynamic roles allow organizations to define roles that match their specific operational structure.

### Why Flat Permission Arrays in the API?

The API uses flat permission arrays (`["product:create", "stock:view"]`) because they are simpler to validate, compare, and manipulate in both frontend and backend. The conversion to grouped JSON objects happens only at the persistence layer for better-auth compatibility. This separation keeps the API contract clean while maintaining database compatibility.

### Why System Role Protection?

System roles (`owner`, `admin`, `member`) are fundamental to better-auth's organization access control. Modifying or deleting them could break authentication and authorization across the entire application. Protection is enforced at two levels: Zod schema validation (prevents the request from being processed) and route handler checks (defensive programming in case the schema is bypassed).

### Why Delete-Recreate for Permission Updates?

When a role's permissions change, the service performs a delete-then-recreate pattern rather than an in-place update. This ensures the `permission` JSON column is cleanly replaced without partial update issues. The `createdAt` is preserved from the original record, and `updatedAt` is set to the current timestamp.

### Why No Pagination?

Custom roles are expected to be few in number per organization (typically 5-20). Loading all roles in a single query is more efficient and simpler than paginating a small dataset. If an organization somehow accumulates a very large number of roles, pagination can be added later without breaking the API contract.

### Why `member:update` Permission for Role Management?

Role management is a subset of member management — creating a role is only useful if it can be assigned to members. By reusing the `member:update` permission, the existing permission system controls who can manage roles without introducing a new permission resource. This keeps the permission model simple.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience, including resource labels, action labels, button text, error messages, and empty states.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for `OrganizationRole` records via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Authentication, organization membership, and access control; provides `authPlugin` with `user`, `organization`, `_authType` context; manages the `OrganizationRole` table schema and system roles; uses the `better-auth/plugins/access` module for permission statement definitions
- **SVC-002**: **better-auth/plugins/access** - Provides `createAccessControl()`, `defaultStatements`, `ownerAc`, `adminAc`, `memberAc` for defining the permission model

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Members module** - Custom roles are assigned to organization members; role deletion should be coordinated with member role reassignment
- **DAT-002**: **API Keys module** - API keys may reference custom roles for scoped access; role changes may affect API key permissions
- **DAT-003**: **Audit Logs** - All role write operations produce audit log entries that must be invalidated in the frontend cache

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer for `OrganizationRole` CRUD operations
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Form** - Form state management with Zod validation
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Checkbox, Button, Input, Label)
- **PLT-006**: **Lucide React** - Icon library (Shield, Plus, Pencil, Trash2, Check, Minus, Loader2)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Creating a Custom Role

```typescript
// POST /roles
{
  "role": "Manajer Gudang",
  "permissions": [
    "product:view",
    "productVariant:view",
    "warehouse:create",
    "warehouse:update",
    "warehouse:delete",
    "warehouse:view",
    "stock:adjust",
    "stock:view",
    "purchaseOrder:view",
    "salesOrder:view"
  ]
}

// Response 201
{
  "id": "Manajer Gudang",
  "role": "Manajer Gudang",
  "permissions": [
    "product:view",
    "productVariant:view",
    "warehouse:create",
    "warehouse:update",
    "warehouse:delete",
    "warehouse:view",
    "stock:adjust",
    "stock:view",
    "purchaseOrder:view",
    "salesOrder:view"
  ],
  "createdAt": "2026-04-04T10:30:00.000Z",
  "updatedAt": null
}
```

### 9.2 System Role Protection

```typescript
// POST /roles
{
  "role": "admin",
  "permissions": ["product:view"]
}
// Response 400: { "message": "Cannot create a system role" }

// PATCH /roles/admin
{
  "permissions": ["product:view"]
}
// Response 400: { "message": "Cannot modify a system role" }

// DELETE /roles/admin
// Response 400: { "message": "Cannot delete a system role" }
```

### 9.3 Available Permissions Response

```typescript
// GET /roles/available-permissions
{
  "resources": [
    "product", "productCategory", "productVariant", "warehouse",
    "supplier", "customer", "purchaseOrder", "purchaseOrderItem",
    "salesOrder", "salesOrderItem", "stock", "apiKey",
    "invitation", "member", "media", "auditLog"
  ],
  "actions": {
    "product": ["create", "update", "delete", "view"],
    "stock": ["adjust", "view"],
    "purchaseOrder": ["create", "update", "delete", "receive", "view"],
    "apiKey": ["create", "read", "update", "delete", "view"],
    "auditLog": ["view"]
  },
  "permissions": [
    "product:create", "product:update", "product:delete", "product:view",
    "stock:adjust", "stock:view",
    "purchaseOrder:create", "purchaseOrder:receive",
    "auditLog:view"
  ]
}
```

### 9.4 Edge Cases

- **System role name collision**: Creating a role with name `owner`, `admin`, or `member` is rejected at the Zod schema level via `isSystemRole()` refine, before reaching the database
- **Empty permissions array**: Submitting an empty `permissions` array is rejected with "At least one permission is required"
- **Invalid permission string**: Including a permission like `"nonexistent:action"` or `"product:nonexistent"` is rejected with "Invalid permission format" via `isValidPermission()` refine
- **Role name too long**: Names exceeding 50 characters are rejected with "Role name too long"
- **Delete-recreate preserves creation time**: When updating a role's permissions, the `createdAt` is preserved from the original record while `updatedAt` is set to `now`
- **Members with deleted roles**: Deleting a custom role does not automatically reassign members who have that role — this is a potential data integrity issue that callers should handle
- **Bracket notation in Eden client**: The `available-permissions` endpoint requires `api.roles['available-permissions'].get()` due to the hyphenated path segment
- **Permission matrix indeterminate state**: When some but not all actions of a resource are selected, the resource-level checkbox displays a minus icon (indeterminate state) rather than check or empty
- **Concurrent role updates**: Two users updating the same role simultaneously could cause a race condition in the delete-recreate pattern — the last write wins
- **Legacy permission format**: The `parsePermissionColumn()` function handles both the current JSON object format and a legacy flat string format for backward compatibility during migration

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/roles/` with `roles.route.ts`, `roles.service.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`; write endpoints use `requirePermission: { member: ['update'] }`
3. **Serialization**: All Date fields return ISO 8601 strings; permissions returned as flat string arrays
4. **System role protection**: System roles cannot be created, modified, or deleted — enforced at schema and handler level
5. **Permission validation**: All permission strings are validated against `permissionActions` before persistence
6. **Format conversion**: Flat permission arrays are converted to grouped JSON objects when writing; grouped JSON is converted to flat arrays when reading
7. **Audit logging**: All write operations call `void logAudit(...)` with correct model (`Role`), operation, and args
8. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
9. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list()`, `details()`, `detail(id)`, `available()`
10. **Cache invalidation**: Mutations invalidate the correct query key scopes including audit log keys
11. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
12. **Permission gates**: Create/edit UI elements gated by `useHasPermission('member:update')`
13. **Permission matrix**: Resource-level toggles with check/indeterminate/empty states, individual action checkboxes, select all/clear all

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Permissions library: `packages/backend/src/libraries/permissions.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Error response schema: `packages/backend/src/common/error.response.ts`
- better-auth access control: `better-auth/plugins/access` — `createAccessControl`, `defaultStatements`, `ownerAc`, `adminAc`, `memberAc`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Frontend permissions hook: `packages/frontend/src/lib/use-permissions.ts`
- Audit logs hooks: `packages/frontend/src/modules/audit-logs/hooks/use-audit-logs.ts`
- Members module: `packages/backend/src/modules/members/` — organization membership management
- API keys module: `packages/backend/src/modules/api-keys/` — API key management with scoped permissions
- Organization model: `packages/backend/prisma/schema.prisma` — `Organization`, `Member`, `OrganizationRole` relations
