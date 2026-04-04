---
title: Permissions Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: permissions
tags: [permissions, rbac, access-control, elysia, prisma, react, tanstack, better-auth]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the permissions domain in BearUang. It covers the Role-Based Access Control (RBAC) permission model, the permission introspection API, the auth plugin macros that enforce permissions on every endpoint, and the frontend hooks that gate UI elements. The permissions module is the foundational security layer that every other route module depends on.

## 1. Purpose & Scope

This specification defines:

- **Permission model**: 16 resources, 59 permission strings, 3 built-in system roles, and dynamic role support via the `OrganizationRole` table
- **Backend enforcement**: Elysia auth plugin macros (`requireAuth`, `requireOrg`, `requirePermission`) applied on every endpoint across all modules
- **Permission introspection API**: The `GET /permissions` endpoint that returns the current user's resolved permission set
- **Frontend permission hooks**: `usePermissions()` and `useHasPermission()` for gating UI elements by permission
- **Database storage**: How custom role permissions are stored in the `OrganizationRole` table as JSON-grouped permission strings
- **Integration with better-auth**: How the access control instance, roles, and dynamic access control are wired into the auth configuration

**Audience**: Developers building new route modules, modifying the permission model, implementing role management, or extending frontend permission-gated UI.

**Assumptions**: The reader is familiar with Elysia.js macros, better-auth organization plugin with access control, Prisma ORM, TanStack Query, and the BearUang module structure.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Permission Statement** | A TypeScript const object mapping resource names to arrays of allowed actions (e.g., `{ product: ['create', 'update', 'delete', 'view'] }`) |
| **Permission String** | A colon-separated string in `"resource:action"` format (e.g., `"product:create"`, `"stock:adjust"`) |
| **Resource** | A domain entity that has one or more permission-gated actions (e.g., `product`, `purchaseOrder`, `stock`) |
| **Action** | An operation that can be performed on a resource (e.g., `view`, `create`, `update`, `delete`, `receive`, `fulfill`, `adjust`) |
| **System Role** | One of three built-in roles (`owner`, `admin`, `member`) whose permissions are defined in code and cannot be modified or deleted via the UI |
| **Dynamic Role** | A custom role created by an organization, stored in the `OrganizationRole` table with per-resource permission entries |
| **Access Control Instance** | The `ac` object created by `createAccessControl(statement)` from `better-auth/plugins/access`, used to define roles and validate permissions |
| **Auth Plugin Macro** | An Elysia macro (`requireAuth`, `requireOrg`, `requirePermission`) that injects authentication and authorization checks into route handlers at compile time |
| **Permission Introspection** | The process of resolving a user's effective permissions by inspecting their role and querying stored permission data |
| **Permission Group** | A JSON object mapping resource names to action arrays (e.g., `{"supplier":["create","update"]}`), stored in the `OrganizationRole.permission` column |
| **viewResources** | The set of resource names a user has at least one action for, used by the frontend to determine which navigation items and pages to display |

## 3. Requirements, Constraints & Guidelines

### 3.1 Permission Model

- **REQ-001**: All permissions are defined in a single `statement` object in `packages/backend/src/libraries/permissions.ts` that maps resource names to arrays of allowed actions
- **REQ-002**: The statement extends `defaultStatements` from `better-auth/plugins/organization/access` to include BearUang-specific resources
- **REQ-003**: Permission strings follow the format `"resource:action"` (e.g., `"product:create"`, `"stock:adjust"`)
- **REQ-004**: The permission model defines exactly 16 resources: `product`, `productCategory`, `productVariant`, `warehouse`, `supplier`, `customer`, `purchaseOrder`, `purchaseOrderItem`, `salesOrder`, `salesOrderItem`, `stock`, `apiKey`, `invitation`, `member`, `media`, `auditLog`
- **REQ-005**: Most resources support four standard actions: `create`, `update`, `delete`, `view`
- **REQ-006**: `purchaseOrder` supports an additional `receive` action for receiving goods
- **REQ-007**: `salesOrder` supports an additional `fulfill` action for fulfilling orders
- **REQ-008**: `stock` supports only `adjust` and `view` actions (stock adjustments are a distinct operation from CRUD)
- **REQ-009**: `apiKey` supports `create`, `read`, `update`, `delete`, `view` actions (uses `read` instead of `view` as a distinct action)
- **REQ-010**: `auditLog` supports only `view` (audit logs are append-only and cannot be modified)

### 3.2 Role Definitions

- **REQ-011**: Three system roles are defined: `owner`, `admin`, `member` — all other role names are treated as dynamic roles
- **REQ-012**: `owner` and `admin` roles have identical permissions: all 59 permission strings across all 16 resources
- **REQ-013**: `member` role has restricted read-heavy permissions with limited write access (see section 4.3 for full matrix)
- **REQ-014**: System roles are identified via `isSystemRole(role: string): boolean` which checks against the `systemRoles` constant
- **REQ-015**: System role permissions are defined in code and resolved by `getAllSystemPermissions()` which iterates all `permissionResources` and `permissionActions`
- **REQ-016**: Dynamic role permissions are stored in the `OrganizationRole` table and resolved at runtime by querying the database

### 3.3 Auth Plugin Enforcement

- **REQ-017**: The `authPlugin` is an Elysia plugin with three macros: `requireAuth`, `requireOrg`, `requirePermission`
- **REQ-018**: `requireAuth` authenticates the request via API key (`x-api-key` header) or session cookie, injecting `user`, `session`, and `_authType` into the route context
- **REQ-019**: `requireOrg` extends authentication with organization resolution, injecting `organization` (with members and invitations) into the route context
- **REQ-020**: `requirePermission(permissions)` accepts a `Record<string, string[]>` object and checks permissions via `auth.api.hasPermission()` for sessions or `auth.api.verifyApiKey()` for API keys
- **REQ-021**: Every endpoint in every route module must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-022**: Every endpoint must declare `requirePermission: { resource: ['action'] }` to enforce RBAC
- **REQ-023**: Unauthenticated requests return `401 Unauthorized`; unauthorized requests return `403 Forbidden`

### 3.4 Permission Introspection API

- **REQ-024**: The `GET /permissions` endpoint returns the current user's effective permissions for their active organization
- **REQ-025**: For system roles, all permissions from the statement are returned without a database query
- **REQ-026**: For dynamic roles, permissions are resolved by querying the `OrganizationRole` table by `organizationId` and `role`
- **REQ-027**: The response returns both `viewResources` (unique resource names) and `permissions` (all `resource:action` strings)
- **REQ-028**: The permission parser supports both JSON object format (`{"supplier":["create","update"]}`) and legacy flat string format (`"supplier:create"`)

### 3.5 Frontend Permission Hooks

- **REQ-029**: `usePermissions()` fetches the permission set via `GET /permissions` with a 5-minute stale time
- **REQ-030**: `useHasPermission(permission: string)` returns a boolean indicating whether the current user has the specified permission
- **REQ-031**: The permissions query uses the query key `['permissions']`
- **REQ-032**: Frontend permission data is stored as `Set<string>` for O(1) lookup performance

### 3.6 Database Storage

- **REQ-033**: Dynamic role permissions are stored in the `OrganizationRole` table with columns: `id`, `organizationId`, `role`, `permission`, `createdAt`, `updatedAt`
- **REQ-034**: Each row in `OrganizationRole` represents a single permission entry for a role within an organization
- **REQ-035**: The `permission` column stores either a JSON object mapping resource names to action arrays (grouped format) or a legacy flat `resource:action` string
- **REQ-036**: The `Member.role` field stores the role name as a string (default: `"member"`)
- **REQ-037**: Dynamic access control is enabled via `dynamicAccessControl: { enabled: true }` in the better-auth organization plugin configuration

### 3.7 Constraints

- **CON-001**: System roles (`owner`, `admin`, `member`) cannot be modified or deleted — their permissions are hardcoded
- **CON-002**: The `requirePermission` macro runs as a `beforeHandle` hook, meaning it executes after `requireAuth` and `requireOrg` have resolved
- **CON-003**: API key authentication does not resolve an organization via `auth.api.getFullOrganization()` — instead it uses `fetchFullOrganization()` with the key's `referenceId` directly
- **CON-004**: The `requirePermission` macro performs two separate authentication checks (one for the macro itself, and one from `requireAuth`/`requireOrg` if also declared), which may result in redundant header parsing
- **CON-005**: The `OrganizationRole` table allows multiple rows per role per organization (one row per permission entry), requiring aggregation at query time
- **CON-006**: Legacy flat string format in the `permission` column must still be supported for backward compatibility
- **CON-007**: The `GET /permissions` endpoint does not use the `requirePermission` macro — it only requires authentication and organization context

### 3.8 Guidelines

- **GUD-001**: When adding a new domain resource, add it to the `statement` object, all system role definitions, `permissionResources`, and `permissionActions` in `permissions.ts`
- **GUD-002**: Use `isValidPermission()` to validate permission strings from external input before processing
- **GUD-003**: Use `getAllPermissions()` to generate the complete set of valid permission strings for UI role editors
- **GUD-004**: Prefer the JSON grouped format (`{"resource":["action1","action2"]}`) over the legacy flat format when writing to `OrganizationRole.permission`
- **GUD-005**: Always gate create/edit/delete UI elements with `useHasPermission()` — never rely solely on backend enforcement for UX
- **GUD-006**: When a new route module is created, include `authPlugin` and declare `requireAuth`, `requireOrg`, and `requirePermission` on every endpoint

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Permission Introspection

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| GET | `/permissions` | Get current user's permissions for their active organization | `requireAuth`, `requireOrg` | `200 PermissionsResponse` |

### 4.2 Response Shapes

```typescript
interface PermissionsResponse {
  viewResources: string[]    // Unique resource names the user has at least one action for
  permissions: string[]      // All "resource:action" strings the user has access to
}

// Example response for an admin:
{
  "viewResources": [
    "product", "productCategory", "productVariant", "warehouse",
    "supplier", "customer", "purchaseOrder", "purchaseOrderItem",
    "salesOrder", "salesOrderItem", "stock", "apiKey",
    "invitation", "member", "media", "auditLog"
  ],
  "permissions": [
    "product:create", "product:update", "product:delete", "product:view",
    "productCategory:create", "productCategory:update", "productCategory:delete", "productCategory:view",
    "productVariant:create", "productVariant:update", "productVariant:delete", "productVariant:view",
    "warehouse:create", "warehouse:update", "warehouse:delete", "warehouse:view",
    "supplier:create", "supplier:update", "supplier:delete", "supplier:view",
    "customer:create", "customer:update", "customer:delete", "customer:view",
    "purchaseOrder:create", "purchaseOrder:update", "purchaseOrder:delete", "purchaseOrder:receive", "purchaseOrder:view",
    "purchaseOrderItem:create", "purchaseOrderItem:update", "purchaseOrderItem:delete", "purchaseOrderItem:view",
    "salesOrder:create", "salesOrder:update", "salesOrder:delete", "salesOrder:fulfill", "salesOrder:view",
    "salesOrderItem:create", "salesOrderItem:update", "salesOrderItem:delete", "salesOrderItem:view",
    "stock:adjust", "stock:view",
    "apiKey:create", "apiKey:read", "apiKey:update", "apiKey:delete", "apiKey:view",
    "invitation:create", "invitation:delete", "invitation:view",
    "member:update", "member:delete", "member:view",
    "media:create", "media:delete", "media:view",
    "auditLog:view"
  ]
}
```

### 4.3 Zod Schema Definitions

```typescript
const permissionsResponse = z.object({
  viewResources: z.array(z.string()),
  permissions: z.array(z.string()),
})
```

### 4.4 Complete Permission Matrix

The following table shows all 16 resources, their allowed actions, and the actions granted to each system role.

| Resource | Available Actions | owner | admin | member |
|----------|-------------------|-------|-------|--------|
| `product` | create, update, delete, view | all | all | view |
| `productCategory` | create, update, delete, view | all | all | view |
| `productVariant` | create, update, delete, view | all | all | view |
| `warehouse` | create, update, delete, view | all | all | view |
| `supplier` | create, update, delete, view | all | all | view |
| `customer` | create, update, delete, view | all | all | create, update, view |
| `purchaseOrder` | create, update, delete, receive, view | all | all | create, view |
| `purchaseOrderItem` | create, update, delete, view | all | all | view |
| `salesOrder` | create, update, delete, fulfill, view | all | all | create, view |
| `salesOrderItem` | create, update, delete, view | all | all | view |
| `stock` | adjust, view | all | all | view |
| `apiKey` | create, read, update, delete, view | all | all | read, view |
| `invitation` | create, delete, view | all | all | view |
| `member` | update, delete, view | all | all | view |
| `media` | create, delete, view | all | all | create, view |
| `auditLog` | view | all | all | view |

**Total**: 16 resources, 59 unique permission strings.

**Member write permissions**: `customer:create`, `customer:update`, `purchaseOrder:create`, `salesOrder:create`, `media:create` — these allow members to perform essential business operations (adding customers, creating orders, uploading media) without granting full administrative access.

### 4.5 Prisma Models

#### OrganizationRole

```prisma
model OrganizationRole {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           String
  permission     String       // JSON object or legacy flat "resource:action" string
  createdAt      DateTime     @default(now())
  updatedAt      DateTime?    @updatedAt

  @@index([organizationId])
  @@index([role])
  @@map("organizationRole")
}
```

#### Member (role field)

```prisma
model Member {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           String       @default("member")  // References a system role or dynamic role name
  createdAt      DateTime

  @@index([organizationId])
  @@index([userId])
  @@map("member")
}
```

#### Organization (relationship)

```prisma
model Organization {
  id              String
  name            String
  slug            String
  logo            String?
  createdAt       DateTime
  metadata        String?
  members         Member[]
  invitations     Invitation[]
  organizationroles OrganizationRole[]   // Dynamic role permission entries
  media           Media[]

  @@unique([slug])
  @@map("organization")
}
```

### 4.6 Permission Storage Formats

The `OrganizationRole.permission` column supports two formats:

**JSON grouped format** (preferred):
```json
{"supplier":["create","update"],"product":["view"]}
```

**Legacy flat format** (backward compatible):
```
supplier:create
```

The `parsePermissionString(value: string)` function handles both formats transparently:

```typescript
function parsePermissionString(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
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
    if (value.includes(':')) return [value]
  }
  return []
}
```

### 4.7 Auth Plugin Macro API

The `authPlugin` exposes three Elysia macros that are consumed as route meta properties:

```typescript
// Macro 1: Authentication only — injects user, session, _authType
{
  requireAuth: true,
  // Context available: { user, session, _authType }
}

// Macro 2: Authentication + organization — injects user, session, organization, _authType
{
  requireAuth: true,
  requireOrg: true,
  // Context available: { user, session, organization, _authType }
  // organization includes: { id, name, slug, members, invitations, organizationroles }
}

// Macro 3: Permission check — returns 403 if denied
{
  requireAuth: true,
  requireOrg: true,
  requirePermission: { product: ['create'] },
  // Checked via auth.api.hasPermission({ headers, body: { permissions } })
  // For API keys: checked via auth.api.verifyApiKey({ body: { key, permissions } })
}
```

### 4.8 Frontend Hook API

```typescript
// Fetch all permissions for the current user (5-minute cache)
export function usePermissions(): UseQueryResult<PermissionsData>
// Returns: { viewResources: Set<string>, allPermissions: Set<string> }

// Check a single permission
export function useHasPermission(permission: string): boolean
// Example: useHasPermission('product:create') => true/false

// Query options for advanced usage (e.g., prefetching, suspense)
export const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
```

### 4.9 Frontend Usage Patterns

```typescript
// Gating a create button
function ProductListPage() {
  const canCreate = useHasPermission('product:create')
  return (
    <div>
      {canCreate && <Button>Tambah Produk</Button>}
    </div>
  )
}

// Gating multiple actions
function ProductDetailPage() {
  const canUpdate = useHasPermission('product:update')
  const canDelete = useHasPermission('product:delete')
  return (
    <div>
      {canUpdate && <Button>Edit</Button>}
      {canDelete && <Button variant="destructive">Hapus</Button>}
    </div>
  )
}

// Checking if user can view a navigation item
function Sidebar() {
  const { data } = usePermissions()
  const viewResources = data?.viewResources ?? new Set()
  return (
    <nav>
      {viewResources.has('product') && <NavItem>Produk</NavItem>}
      {viewResources.has('purchaseOrder') && <NavItem>Pembelian</NavItem>}
      {viewResources.has('salesOrder') && <NavItem>Penjualan</NavItem>}
    </nav>
  )
}
```

### 4.10 Auth Integration Configuration

```typescript
// packages/backend/src/integrations/auth.ts
import { ac, owner, admin, member } from '#libraries/permissions'

export const auth = betterAuth({
  basePath: '/auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  trustedOrigins: ['*'],
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,                        // Access control instance with custom statement
      roles: { owner, admin, member },  // Three system roles
      dynamicAccessControl: { enabled: true },  // Enable custom role support via OrganizationRole table
    }),
    apiKey({
      references: 'organization',       // API keys are scoped to organizations
      enableSessionForAPIKeys: false,
      enableMetadata: true,
      defaultPrefix: 'bk_',
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60,     // 1 hour window
        maxRequests: 1000,
      },
    }),
  ],
})
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with the `owner` role, When `GET /permissions` is called, Then all 59 permission strings and all 16 viewResources are returned
- **AC-002**: Given an authenticated user with the `admin` role, When `GET /permissions` is called, Then all 59 permission strings and all 16 viewResources are returned (identical to owner)
- **AC-003**: Given an authenticated user with the `member` role, When `GET /permissions` is called, Then only the member's restricted permission set is returned (customer:create/update/view, purchaseOrder:create/view, salesOrder:create/view, media:create/view, and all view-only permissions)
- **AC-004**: Given an authenticated user with a dynamic role, When `GET /permissions` is called, Then permissions are resolved from the `OrganizationRole` table by matching `organizationId` and `role`
- **AC-005**: Given a dynamic role with JSON grouped permissions `{"supplier":["create","update"]}`, When the permissions are parsed, Then the flat strings `["supplier:create", "supplier:update"]` are returned
- **AC-006**: Given a dynamic role with a legacy flat permission `"product:view"`, When the permissions are parsed, Then the flat string `["product:view"]` is returned
- **AC-007**: Given an unauthenticated request to `GET /permissions`, When the endpoint is called, Then a `401 Unauthorized` is returned
- **AC-008**: Given a request without an active organization context, When `GET /permissions` is called, Then `{ viewResources: [], permissions: [] }` is returned
- **AC-009**: Given the `requirePermission` macro with `{ product: ['create'] }`, When a user without `product:create` calls the endpoint, Then a `403 Forbidden` is returned
- **AC-010**: Given an API key with scoped permissions, When the key is used to call an endpoint protected by `requirePermission`, Then the API key's permissions are checked instead of the session user's permissions
- **AC-011**: Given the frontend `useHasPermission('product:create')` hook, When the current user has `product:create` in their permission set, Then the hook returns `true`
- **AC-012**: Given the frontend `useHasPermission('product:create')` hook, When the current user does not have `product:create`, Then the hook returns `false`
- **AC-013**: Given the `isValidPermission()` function, When called with a valid permission string like `"stock:adjust"`, Then it returns `true`
- **AC-014**: Given the `isValidPermission()` function, When called with an invalid string like `"invalid:action"` or `"nodelimiter"`, Then it returns `false`
- **AC-015**: Given the `isSystemRole()` function, When called with `"owner"`, `"admin"`, or `"member"`, Then it returns `true`; for any other string it returns `false`

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for permission utility functions, integration tests for the permissions endpoint and auth plugin macros
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `permissions.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Unit tests**:
  - `parsePermissionString()`: JSON grouped format, legacy flat format, invalid input
  - `getAllSystemPermissions()`: returns all 59 permission strings
  - `isValidPermission()`: valid and invalid permission strings
  - `isSystemRole()`: system and non-system role names
  - `getAllPermissions()`: matches `getAllSystemPermissions()` output
- **Integration tests**:
  - `GET /permissions` for each system role (owner, admin, member)
  - `GET /permissions` for dynamic roles with various `OrganizationRole` entries
  - `requirePermission` macro returns 403 for unauthorized requests
  - `requireAuth` macro returns 401 for unauthenticated requests
  - API key authentication path through `requirePermission`
- **Frontend tests**:
  - `usePermissions` hook with mock API response
  - `useHasPermission` hook returns correct boolean for present/absent permissions
  - `permissionsQueryOptions` has correct query key and stale time
- **CI/CD Integration**: Run `bun test` in CI pipeline

## 7. Rationale & Context

### Why better-auth Access Control?

The `better-auth/plugins/access` module provides a structured way to define permission statements and roles with type-safe enforcement. It integrates natively with the organization plugin, enabling per-organization role management. The `createAccessControl()` API produces an `ac` instance that both the auth system and application code can reference consistently.

### Why Three System Roles?

The `owner`, `admin`, and `member` roles cover the most common organizational hierarchy. Owners and admins have identical permissions (full access) because both are trusted administrators — the distinction is semantic (ownership vs. delegated administration). Members have read-heavy access with limited write permissions for essential business operations (creating customers, creating orders, uploading media), preventing accidental data corruption while enabling day-to-day work.

### Why Dynamic Roles?

Organizations may need custom roles (e.g., "warehouse_manager", "cashier", "accountant") with specific permission combinations that don't map to the three system roles. Dynamic access control (`dynamicAccessControl: { enabled: true }`) enables this by storing per-role permissions in the `OrganizationRole` table, which the permission introspection endpoint reads at runtime.

### Why Separate viewResources from permissions?

The `viewResources` field allows the frontend to quickly determine which navigation sections and pages a user should see without checking individual actions. A user with any permission on a resource (even just `view`) will see the resource in navigation. This avoids rendering pages the user cannot access at all.

### Why 5-Minute Stale Time on Permissions?

Permissions change infrequently (typically only when an admin modifies a member's role). A 5-minute stale time reduces API calls while keeping permission state reasonably fresh. If a user's role is changed, their UI will update within 5 minutes or on next page reload.

### Why JSON Grouped Format for OrganizationRole?

Storing permissions as `{"resource":["action1","action2"]}` reduces the number of rows needed compared to one row per flat permission string. It also makes it easier to display and edit permissions in a role management UI (group by resource, toggle individual actions).

### Why Two Authentication Paths in requirePermission?

The `requirePermission` macro handles both session-based authentication (via `auth.api.hasPermission()`) and API key authentication (via `auth.api.verifyApiKey()` with scoped permissions). API keys need their own permission checking path because they don't have session-based role resolution.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Stores `OrganizationRole`, `Member`, `Organization`, and `Apikey` tables via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Provides organization plugin with access control (`createAccessControl`), permission checking (`hasPermission`, `verifyApiKey`), and dynamic access control
- **SVC-002**: **@better-auth/api-key** - Provides API key authentication with organization-scoped permissions, rate limiting, and metadata support

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **All route modules** - Every route module (`products`, `suppliers`, `customers`, `purchase-orders`, `sales-orders`, `warehouses`, `stock-movements`, `api-keys`, `members`, `media`, `audit-logs`) depends on the permissions module via `authPlugin` macros
- **DAT-002**: **Member table** - The `role` field on `Member` determines which system or dynamic role to use for permission resolution
- **DAT-003**: **Organization table** - The `OrganizationRole` relation stores dynamic role permissions per organization

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with macro system for compile-time injection of auth/permission checks
- **PLT-002**: **Prisma ORM** - Database access layer for querying `OrganizationRole` and `Member` tables
- **PLT-003**: **TanStack Query** - Server state management for caching permission data on the frontend
- **PLT-004**: **better-auth/plugins/access** - Access control creation and role definition
- **PLT-005**: **better-auth/plugins/organization** - Organization membership, role assignment, and dynamic access control

### Compliance Dependencies
- **COM-001**: **RBAC enforcement** - All endpoints must declare `requirePermission` to prevent unauthorized access to domain operations

## 9. Examples & Edge Cases

### 9.1 Adding a New Resource

When adding a new domain resource (e.g., `expense`), the following files must be updated:

```typescript
// 1. packages/backend/src/libraries/permissions.ts
// Add to statement
const statement = {
  ...defaultStatements,
  // ... existing resources
  expense: ['create', 'update', 'delete', 'view'],
} as const

// Add to owner role
export const owner = ac.newRole({
  ...ownerAc.statements,
  // ... existing permissions
  expense: ['create', 'update', 'delete', 'view'],
})

// Repeat for admin and member roles

// Add to permissionResources
export const permissionResources = [
  // ... existing resources
  'expense',
] as const

// Add to permissionActions
export const permissionActions: Record<string, readonly string[]> = {
  // ... existing actions
  expense: ['create', 'update', 'delete', 'view'],
}
```

### 9.2 Dynamic Role Permission Resolution Flow

```typescript
// 1. User authenticates → session resolved → organization fetched
// 2. Member found: member.role = "warehouse_manager"
// 3. isSystemRole("warehouse_manager") → false
// 4. Query OrganizationRole table:
//    SELECT permission FROM organizationRole
//    WHERE organizationId = 'org-123' AND role = 'warehouse_manager'
//
// Results (3 rows):
//   Row 1: '{"product":["view"]}'
//   Row 2: '{"warehouse":["create","update","delete","view"]}'
//   Row 3: '{"stock":["adjust","view"]}'
//
// 5. parsePermissionString() on each row:
//   Row 1 → ["product:view"]
//   Row 2 → ["warehouse:create","warehouse:update","warehouse:delete","warehouse:view"]
//   Row 3 → ["stock:adjust","stock:view"]
//
// 6. Aggregate into Set → extract unique resources:
//   viewResources: ["product", "warehouse", "stock"]
//   permissions: ["product:view", "warehouse:create", ..., "stock:adjust", "stock:view"]
```

### 9.3 API Key Permission Check Flow

```typescript
// 1. Request includes header: x-api-key: bk_abc123...
// 2. requirePermission macro detects API key
// 3. Calls auth.api.verifyApiKey({ body: { key, permissions } })
//    where permissions = { product: ['create'] }
// 4. better-auth checks if the API key's stored permissions include product:create
// 5. If valid → request proceeds; if not → 403 Forbidden
```

### 9.4 Edge Cases

- **User with no organization**: When a user has no active organization, `GET /permissions` returns `{ viewResources: [], permissions: [] }` — the frontend should handle this gracefully (e.g., show an "join or create an organization" prompt)
- **Dynamic role with no OrganizationRole entries**: A user assigned a custom role that has no rows in `OrganizationRole` receives `{ viewResources: [], permissions: [] }` — equivalent to no access
- **Mixed format permissions in same role**: If a dynamic role has some entries in JSON grouped format and some in legacy flat format, `parsePermissionString()` handles both transparently
- **API key without userId metadata**: If an API key was created without a `userId` in metadata, the `requireAuth` macro returns `null` and the request is rejected with 401 — API keys must have a valid userId to authenticate
- **Concurrent role changes**: If an admin changes a user's role while the user has an active session, the permissions cache (5-minute stale time) means the user may retain old permissions for up to 5 minutes
- **Permission string validation**: `isValidPermission()` returns `false` for strings with no colon separator (e.g., `"productcreate"`) and for unknown resources (e.g., `"nonexistent:view"`)
- **System role name collision**: If an organization creates a dynamic role named `"owner"`, `isSystemRole()` will return `true` and the system role permissions will be used instead of the dynamic role's stored permissions

## 10. Validation Criteria

A module or feature conforming to this specification must satisfy:

1. **Permission declaration**: Every endpoint declares `requirePermission: { resource: ['action'] }` in route meta
2. **Auth plugin usage**: Every route plugin uses `authPlugin` (`.use(authPlugin)`)
3. **System role completeness**: `owner` and `admin` have all 59 permissions; `member` has the restricted set defined in section 4.3
4. **Permission introspection**: `GET /permissions` returns correct `viewResources` and `permissions` for all three system roles
5. **Dynamic role resolution**: Custom roles resolve permissions from `OrganizationRole` table with correct parsing of both JSON and legacy formats
6. **Frontend gating**: UI elements for create/edit/delete operations are gated by `useHasPermission()`
7. **Permission storage**: Dynamic role permissions are stored in `OrganizationRole` table with proper `organizationId` and `role` scoping
8. **API key support**: `requirePermission` macro correctly validates API key permissions via `auth.api.verifyApiKey()`
9. **Error responses**: Unauthenticated requests return 401; unauthorized requests return 403
10. **New resource onboarding**: Adding a new resource requires updates to `statement`, all role definitions, `permissionResources`, and `permissionActions`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Permissions library: `packages/backend/src/libraries/permissions.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Auth integration: `packages/backend/src/integrations/auth.ts`
- Permissions route: `packages/backend/src/modules/permissions/permissions.route.ts`
- Frontend permission hooks: `packages/frontend/src/lib/use-permissions.ts`
- Prisma schema: `packages/backend/prisma/schema.prisma` (OrganizationRole, Member, Organization, Apikey models)
- better-auth access control: `better-auth/plugins/access` — `createAccessControl()` API
- better-auth organization plugin: `better-auth/plugins/organization` — `dynamicAccessControl` option
- better-auth API key plugin: `@better-auth/api-key` — scoped permissions on API keys
- Products spec: `specs/products/spec-v1.md` — reference for route module patterns that consume permissions
