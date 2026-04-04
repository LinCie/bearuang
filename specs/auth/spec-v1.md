---
title: Auth Infrastructure Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: auth
tags: [auth, better-auth, organizations, rbac, api-keys, sessions, permissions, elysia, react, tanstack]
---

# Introduction

This specification documents the authentication and authorization infrastructure that powers the entire BearUang application. Auth is the most depended-upon module in the system -- every route plugin uses `authPlugin`, and every frontend dashboard route depends on the session and permission layers. It covers four closely related subsystems: **Session Authentication** (email/password via better-auth), **Organization Membership** (multi-tenant workspace scoping), **Role-Based Access Control** (RBAC with system and custom roles), and **API Key Authentication** (machine-to-machine access with scoped permissions).

## 1. Purpose & Scope

This specification defines:

- **Backend auth integration**: better-auth configuration with PostgreSQL adapter, organization plugin, and API key plugin
- **Auth plugin (Elysia macro)**: Three macros (`requireAuth`, `requireOrg`, `requirePermission`) that enforce authentication and authorization on every route
- **RBAC permission model**: Access control definitions, three system roles (owner, admin, member), custom dynamic roles, and the permission resolution flow
- **Session management**: JWT-based sessions via better-auth with `activeOrganizationId` for multi-tenant context
- **API key authentication**: Machine-to-machine auth flow with `x-api-key` header, rate limiting, and scoped permissions
- **Organization membership**: Multi-tenant model with Member, Invitation, and OrganizationRole entities
- **Frontend auth client**: better-auth/react integration with organization and API key plugins
- **Frontend session hook**: TanStack Query `queryOptions` for session with caching strategy
- **Frontend permissions hook**: `usePermissions()` and `useHasPermission()` for client-side permission gating
- **Auth routes**: Sign-in, sign-up, organization selection, and dashboard auth guards

**Audience**: Developers building new modules (which must integrate with auth), modifying the permission model, or debugging authentication flows.

**Assumptions**: The reader is familiar with better-auth, Elysia.js macros, Prisma ORM, TanStack Query, and the concept of multi-tenant organization scoping.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **better-auth** | Open-source authentication library providing session management, organization support, and plugin ecosystem |
| **authPlugin** | Elysia macro plugin that provides `requireAuth`, `requireOrg`, and `requirePermission` macros for route-level auth enforcement |
| **Session** | A server-side session created by better-auth, stored in the `Session` Prisma model with a JWT token and `activeOrganizationId` |
| **API Key** | A machine-to-machine credential prefixed with `bk_`, stored in the `Apikey` Prisma model, passed via `x-api-key` header |
| **Organization** | A multi-tenant workspace (`Organization` model) that scopes all business data (products, orders, etc.) via `organizationId` |
| **Member** | A join record (`Member` model) linking a `User` to an `Organization` with an assigned role |
| **Invitation** | A pending invitation (`Invitation` model) sent to an email to join an organization with a specific role |
| **System Role** | One of three built-in roles: `owner`, `admin`, `member` -- these cannot be modified or deleted |
| **Custom Role** | A user-defined role stored in the `OrganizationRole` table with granular permission entries |
| **Permission Statement** | A `Record<string, string[]>` mapping resource names to allowed actions (e.g., `{ product: ['create', 'view'] }`) |
| **Permission String** | A colon-separated string in `"resource:action"` format (e.g., `"product:create"`, `"stock:view"`) |
| **Access Control (ac)** | The `createAccessControl` instance from better-auth that defines all available resources and actions |
| **Dynamic Access Control** | better-auth feature that allows per-organization custom roles defined at runtime |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Auth Type** | Discriminator string (`'session'` or `'api_key'`) indicating how the current request was authenticated |
| **`_authType`** | Derived context property injected by `authPlugin` into route handlers, used for audit logging |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Auth Integration

- **REQ-001**: The auth system is initialized via `betterAuth()` in `packages/backend/src/integrations/auth.ts` with `basePath: '/auth'`
- **REQ-002**: Database connectivity uses `prismaAdapter(prisma, { provider: 'postgresql' })`
- **REQ-003**: Email/password authentication is enabled via `emailAndPassword: { enabled: true }`
- **REQ-004**: `trustedOrigins` is set to `['*']` to allow cross-origin requests during development
- **REQ-005**: The organization plugin is configured with `ac` (access control), `roles` (owner, admin, member), and `dynamicAccessControl: { enabled: true }`
- **REQ-006**: The API key plugin is configured with `references: 'organization'`, `defaultPrefix: 'bk_'`, `enableSessionForAPIKeys: false`, and `enableMetadata: true`
- **REQ-007**: API key rate limiting is enabled at `1000` requests per `60` minutes (`1000 * 60 * 60` ms window)
- **REQ-008**: The auth handler is mounted directly on the Elysia app via `.mount(auth.handler)` -- this mounts all better-auth endpoints under `/auth/*`

### 3.2 Auth Plugin (Elysia Macros)

- **REQ-009**: The auth plugin is an Elysia instance with `{ name: 'auth' }` using `.macro()` to define three macros: `requireAuth`, `requireOrg`, `requirePermission`
- **REQ-010**: `requireAuth` resolves before the route handler runs, returning `{ user, session, _authType }` on success or `401` on failure
- **REQ-011**: `requireOrg` resolves before the route handler, returning `{ user, session, organization, _authType }` on success or `401` on failure
- **REQ-012**: `requirePermission(permissions)` runs as a `beforeHandle` hook, returning `403 Forbidden` if the caller lacks the required permissions
- **REQ-013**: Authentication tries `x-api-key` header first, then falls back to session-based authentication (cookie header)
- **REQ-014**: API key auth extracts the organization via `result.key.referenceId` and fetches the full organization with members and invitations
- **REQ-015**: Session auth calls `auth.api.getSession({ headers })` and then `auth.api.getFullOrganization({ headers })` for organization resolution
- **REQ-016**: All auth errors are caught and logged via `logger.error` or `logger.info`; the response is always `401` (never `500`) for auth failures
- **REQ-017**: The `authenticate` helper function is shared between `requireAuth` and `requireOrg` to avoid code duplication

### 3.3 RBAC Permission Model

- **REQ-018**: The access control instance (`ac`) is created via `createAccessControl(statement)` where `statement` defines all resources and their available actions
- **REQ-019**: The statement extends `defaultStatements` from better-auth's organization access module with 15 BearUang-specific resources
- **REQ-020**: Three system roles are defined: `owner` (all permissions), `admin` (all permissions), `member` (read-only for most resources, limited create for customer/purchaseOrder/salesOrder/media)
- **REQ-021**: System roles spread their base statements from `ownerAc.statements`, `adminAc.statements`, and `memberAc.statements` respectively, then add BearUang-specific permissions
- **REQ-022**: The `member` role has restricted permissions: only `view` for most resources, `create` for customer/purchaseOrder/salesOrder, `read` + `view` for apiKey, and `create` + `view` for media
- **REQ-023**: Custom roles are supported via `dynamicAccessControl: { enabled: true }` and stored in the `OrganizationRole` Prisma model
- **REQ-024**: `permissionResources` exports all 15 resource names as a readonly tuple for programmatic access
- **REQ-025**: `permissionActions` exports the mapping of resource names to their available actions
- **REQ-026**: `PermissionString` is a template literal type: `` `${(typeof permissionResources)[number]}:${string}` ``
- **REQ-027**: `getAllPermissions()` generates all valid `resource:action` strings from the permission definitions
- **REQ-028**: `isValidPermission()` validates a permission string by parsing `resource:action` and checking against `permissionActions`
- **REQ-029**: `systemRoles` is a readonly tuple `['owner', 'admin', 'member']`; `isSystemRole()` checks membership

### 3.4 Session Management

- **REQ-030**: Sessions are managed by better-auth and stored in the `Session` Prisma model
- **REQ-031**: The session token is stored in a cookie and validated on each request via `auth.api.getSession({ headers })`
- **REQ-032**: Each session has an `activeOrganizationId` field that determines the current organization context
- **REQ-033**: Organization switching is done via `authClient.organization.setActive({ organizationId })`, which updates `activeOrganizationId` on the session
- **REQ-034**: After sign-in/sign-up/organization-switch, the frontend invalidates the `['session']` query key and refetches session data
- **REQ-035**: The frontend session query uses `staleTime: 1000 * 60 * 5` (5 minutes) and `retry: false`

### 3.5 API Key Authentication

- **REQ-036**: API keys are identified by the `x-api-key` HTTP header
- **REQ-037**: API key verification uses `auth.api.verifyApiKey({ body: { key: apiKey } })` for auth checks and `auth.api.verifyApiKey({ body: { key: apiKey, permissions } })` for permission checks
- **REQ-038**: API keys reference an organization via `referenceId` (configured as `references: 'organization'`)
- **REQ-039**: API keys store `metadata.userId` to associate the key with a user for audit logging
- **REQ-040**: API keys do not create sessions (`enableSessionForAPIKeys: false`), so `session` is `null` for API key auth
- **REQ-041**: API keys have a default prefix of `bk_` for easy identification
- **REQ-042**: API key rate limiting is enforced at the better-auth level (1000 requests per hour)
- **REQ-043**: The `Apikey` model stores `permissions` as a JSON string, `enabled` as a nullable boolean, and `remaining` for quota tracking
- **REQ-044**: API keys support expiration via the `expiresAt` field and optional refill intervals

### 3.6 Organization Membership

- **REQ-045**: Every user accessing business data must be a `Member` of an `Organization`
- **REQ-046**: The `Member` model links `userId` to `organizationId` with a default role of `"member"`
- **REQ-047**: Organizations have a unique `slug` field for URL-friendly identification
- **REQ-048**: Organizations support optional `metadata` (stored as a JSON string) for business type, description, etc.
- **REQ-049**: Invitations are sent via the `Invitation` model with `status: 'pending'` and an `expiresAt` timestamp
- **REQ-050**: The dashboard layout guard (`_dashboard/route.tsx`) redirects to `/organizations` if `session.activeOrganizationId` is null
- **REQ-051**: The organization selection page lists all organizations the user is a member of, plus pending invitations
- **REQ-052**: Accepting an invitation activates the organization and navigates to the dashboard

### 3.7 Frontend Auth Client

- **REQ-053**: The auth client is created via `createAuthClient()` from `better-auth/react` with `organizationClient()` and `apiKeyClient()` plugins
- **REQ-054**: The `baseURL` is configured from `VITE_PUBLIC_BACKEND_URL` environment variable, defaulting to `http://localhost:8000`
- **REQ-055**: Key exports include: `signIn`, `signOut`, `signUp`, `useSession`, `useActiveOrganization`, `useListOrganizations`, `useActiveMember`
- **REQ-056**: The Eden Treaty API client (`api`) is created via `treaty<App>()` with `{ fetch: { credentials: 'include' } }` for cookie-based session auth
- **REQ-057**: The Eden Treaty client connects to the same `VITE_PUBLIC_BACKEND_URL`

### 3.8 Frontend Permissions

- **REQ-058**: `permissionsQueryOptions()` is a TanStack Query `queryOptions` with `queryKey: ['permissions']`, `staleTime: 5 minutes`
- **REQ-059**: The permissions endpoint (`GET /permissions`) returns `{ viewResources: string[], permissions: string[] }`
- **REQ-060**: `useHasPermission(permission: string)` returns a boolean indicating if the current user has the specified `resource:action` permission
- **REQ-061**: The dashboard route guard uses `ROUTE_PERMISSION_MAP` to check view permissions before rendering dashboard sub-routes
- **REQ-062**: `ROUTE_PERMISSION_MAP` maps route prefixes to resource names: `/products` -> `product`, `/api-keys` -> `apiKey`, `/audit-logs` -> `auditLog`, etc.

### 3.9 Constraints

- **CON-001**: better-auth handles its own routes under `/auth/*` -- these are mounted via `.mount(auth.handler)` and are not Elysia plugins, so they do not go through the OpenAPI schema or CORS middleware in the same way
- **CON-002**: API key authentication does not create a session (`enableSessionForAPIKeys: false`), so `session` is always `null` for API key auth -- code must check `_authType` to handle this
- **CON-003**: The `authenticate()` function in `authPlugin` calls `auth.api.getSession()` and `auth.api.verifyApiKey()` on every request -- there is no caching layer at the Elysia level
- **CON-004**: The `permissions` field on the `Apikey` model is stored as a `String?` (JSON), not a native JSON column, requiring manual JSON parsing
- **CON-005**: `OrganizationRole.permission` is also stored as a `String` (JSON), not a native JSON column
- **CON-006**: The `fetchFullOrganization()` helper in `authPlugin` loads all members with user data and all invitations -- this is potentially expensive for large organizations
- **CON-007**: `trustedOrigins: ['*']` must be restricted to specific domains in production
- **CON-008**: System roles (`owner`, `admin`, `member`) cannot be modified, renamed, or deleted -- custom roles are stored separately in `OrganizationRole`
- **CON-009**: The sign-in and sign-up pages use `beforeLoad` to check for an existing session and redirect to `/` -- this runs before the component mounts, so the redirect is immediate

### 3.10 Guidelines

- **GUD-001**: Every route module must use `authPlugin` (`.use(authPlugin)`) -- this is the single source of truth for auth enforcement
- **GUD-002**: Use `requireAuth` for endpoints that only need user identity (rare); use `requireOrg` for endpoints that need organization context (most cases); use `requirePermission` for fine-grained access control
- **GUD-003**: Always destructure `{ user, organization, _authType }` from the route context when using `requireOrg` -- `_authType` is needed for audit logging
- **GUD-004**: Use `useHasPermission('resource:action')` on the frontend to gate UI elements; use `ROUTE_PERMISSION_MAP` in the dashboard guard for route-level gating
- **GUD-005**: After any auth state change (sign in, sign out, organization switch, invitation accept), invalidate `['session']` and `['permissions']` query keys, then refetch
- **GUD-006**: When creating API keys, always include `metadata: { userId }` so audit logs can attribute actions to the key owner

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints (better-auth Managed)

better-auth manages the following endpoints automatically under `/auth/*`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/sign-up/email` | Register a new user with email and password |
| POST | `/auth/sign-in/email` | Sign in with email and password |
| POST | `/auth/sign-out` | Sign out (invalidate session) |
| GET | `/auth/get-session` | Get current session and user |
| POST | `/auth/organization/create` | Create a new organization |
| POST | `/auth/organization/set-active` | Set the active organization for the current session |
| GET | `/auth/organization/list` | List organizations the current user is a member of |
| GET | `/auth/organization/get-full` | Get the full active organization with members and invitations |
| POST | `/auth/organization/invite` | Invite a user to an organization |
| POST | `/auth/organization/accept-invitation` | Accept a pending invitation |
| POST | `/auth/organization/reject-invitation` | Reject a pending invitation |
| POST | `/auth/api-key/create` | Create a new API key |
| GET | `/auth/api-key/list` | List API keys |
| PATCH | `/auth/api-key/update` | Update an API key |
| DELETE | `/auth/api-key/delete` | Delete an API key |
| POST | `/auth/api-key/verify` | Verify an API key |

### 4.2 HTTP Endpoints (BearUang Custom)

#### API Keys (Elysia Route)

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| POST | `/api-keys` | Create an API key (returns key with secret) | `apiKey:create` | `200 ApiKeyWithSecret` |
| GET | `/api-keys` | List all API keys for the organization | `apiKey:read` | `200 ApiKey[]` |
| GET | `/api-keys/:id` | Get a specific API key by ID | `apiKey:read` | `200 ApiKey` or `404` |
| PATCH | `/api-keys/:id` | Update API key (name, enabled, permissions, rate limit) | `apiKey:update` | `200 ApiKey` or `404` |
| DELETE | `/api-keys/:id` | Revoke and delete an API key | `apiKey:delete` | `200 { message }` or `404` |

#### Permissions

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/permissions` | Get current user's permissions for the active organization | Auth required | `200 { viewResources, permissions }` |

#### Roles

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/roles/available-permissions` | List all available permission resources, actions, and strings | Auth required | `200 AvailablePermissions` |
| GET | `/roles` | List custom roles for the organization | Auth required | `200 Role[]` |
| GET | `/roles/:id` | Get a specific custom role | Auth required | `200 Role` or `404` |
| POST | `/roles` | Create a custom role | `member:update` | `201 Role` or `400` |
| PATCH | `/roles/:id` | Update a custom role (name, permissions) | `member:update` | `200 Role` or `400/404` |
| DELETE | `/roles/:id` | Delete a custom role | `member:update` | `200 { message }` or `400/404` |

### 4.3 Zod Schema Definitions

#### Permissions Response

```typescript
const permissionsResponse = z.object({
  viewResources: z.array(z.string()),
  permissions: z.array(z.string()),
})
```

#### Available Permissions Response

```typescript
const availablePermissionsSchema = z.object({
  resources: z.array(z.string()),
  actions: z.record(z.string(), z.array(z.string())),
  permissions: z.array(z.string()),
})
```

#### Role

```typescript
const roleSchema = z.object({
  id: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
})

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
})

const updateRoleDto = createRoleDto.partial()
```

#### API Key

```typescript
const apiKeySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable(),
  prefix: z.string().nullable(),
  enabled: z.boolean().nullable(),
  permissions: z.record(z.string(), z.array(z.string())).nullable(),
  rateLimitMax: z.number().nullable(),
  rateLimitTimeWindow: z.number().nullable(),
  remaining: z.number().nullable(),
  lastRequest: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})

const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string(),
})

const createApiKeyDto = z.object({
  name: z.string().min(1).max(64),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  expiresIn: z.number().positive().optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const updateApiKeyDto = z.object({
  name: z.string().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
```

### 4.4 Prisma Models

#### User

```prisma
model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  members     Member[]
  invitations Invitation[]

  @@unique([email])
  @@map("user")
}
```

#### Session

```prisma
model Session {
  id                   String   @id
  expiresAt            DateTime
  token                String
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  ipAddress            String?
  userAgent            String?
  userId               String
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activeOrganizationId String?

  @@unique([token])
  @@index([userId])
  @@map("session")
}
```

#### Account

```prisma
model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}
```

#### Organization

```prisma
model Organization {
  id      String  @id
  name    String
  slug    String
  logo    String?
  createdAt DateTime
  metadata String?
  members     Member[]
  invitations Invitation[]

  organizationroles OrganizationRole[]

  media Media[]

  @@unique([slug])
  @@map("organization")
}
```

#### Member

```prisma
model Member {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           String       @default("member")
  createdAt      DateTime

  @@index([organizationId])
  @@index([userId])
  @@map("member")
}
```

#### Invitation

```prisma
model Invitation {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String
  role           String?
  status         String       @default("pending")
  expiresAt      DateTime
  createdAt      DateTime     @default(now())
  inviterId      String
  user           User         @relation(fields: [inviterId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([email])
  @@map("invitation")
}
```

#### OrganizationRole

```prisma
model OrganizationRole {
  id             String       @id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           String
  permission     String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime?    @updatedAt

  @@index([organizationId])
  @@index([role])
  @@map("organizationRole")
}
```

#### Apikey

```prisma
model Apikey {
  id                  String    @id
  configId            String    @default("default")
  name                String?
  start               String?
  referenceId         String
  prefix              String?
  key                 String
  refillInterval      Int?
  refillAmount        Int?
  lastRefillAt        DateTime?
  enabled             Boolean?  @default(true)
  rateLimitEnabled    Boolean?  @default(true)
  rateLimitTimeWindow Int?      @default(86400000)
  rateLimitMax        Int?      @default(10)
  requestCount        Int?      @default(0)
  remaining           Int?
  lastRequest         DateTime?
  expiresAt           DateTime?
  createdAt           DateTime
  updatedAt           DateTime
  permissions         String?
  metadata            String?

  @@index([configId])
  @@index([referenceId])
  @@index([key])
  @@map("apikey")
}
```

#### Verification

```prisma
model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}
```

### 4.5 Frontend Query Key Factories

```typescript
// Session query
const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const { data } = await authClient.getSession()
    return data
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: false,
})

// Permissions query
const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
```

### 4.6 Frontend Route Guard Flow

```
_signin.tsx   beforeLoad: session exists? -> redirect to /
_signup.tsx   beforeLoad: session exists? -> redirect to /
_organizations.tsx  beforeLoad: no session? -> redirect to /signin
_dashboard/route.tsx  beforeLoad:
  1. no session? -> redirect to /signin
  2. no activeOrganizationId? -> redirect to /organizations
  3. no view permission for route? -> redirect to /
```

### 4.7 Dashboard Route Permission Map

```typescript
const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/products': 'product',
  '/product-categories': 'productCategory',
  '/warehouses': 'warehouse',
  '/stock-movements': 'stock',
  '/suppliers': 'supplier',
  '/customers': 'customer',
  '/purchase-orders': 'purchaseOrder',
  '/sales-orders': 'salesOrder',
  '/pos': 'salesOrder',
  '/members': 'member',
  '/api-keys': 'apiKey',
  '/audit-logs': 'auditLog',
}
```

The guard checks `location.pathname === route || location.pathname.startsWith(route + '/')` for prefix matching.

### 4.8 Frontend File Structure

```
lib/
  auth-client.ts          # better-auth/react client with organizationClient + apiKeyClient plugins
  session.ts              # sessionQueryOptions for TanStack Query
  api.ts                  # Eden Treaty type-safe API client
  use-permissions.ts      # permissionsQueryOptions, usePermissions(), useHasPermission()

routes/
  __root.tsx              # Root layout (TooltipProvider, Toaster, PWA)
  signin.tsx              # Sign-in page with email/password form
  signup.tsx              # Sign-up page with name/email/password/confirm/terms form
  organizations.tsx       # Organization selection + creation + invitation handling
  _dashboard/
    route.tsx             # Dashboard auth guard (session, org, permission checks)
```

## 5. Acceptance Criteria

- **AC-001**: Given an unauthenticated request to any endpoint using `requireAuth` or `requireOrg`, When the request is made, Then a `401 Unauthorized` is returned
- **AC-002**: Given a request with a valid session cookie and active organization, When `requireOrg` is applied, Then `{ user, session, organization, _authType: 'session' }` is injected into the route context
- **AC-003**: Given a request with a valid `x-api-key` header, When `requireOrg` is applied, Then `{ user, session: null, organization, _authType: 'api_key' }` is injected into the route context
- **AC-004**: Given an authenticated user with the `owner` role, When any permission check is performed, Then all permissions are granted
- **AC-005**: Given an authenticated user with the `member` role, When checking `product:create`, Then the permission is denied
- **AC-006**: Given an authenticated user with the `member` role, When checking `product:view`, Then the permission is granted
- **AC-007**: Given a custom role with `{ product: ['view', 'create'] }`, When checking `product:update`, Then the permission is denied
- **AC-008**: Given a sign-in request with valid credentials, When `signIn.email()` is called, Then the session is created and `activeOrganizationId` is set (if the user has organizations)
- **AC-009**: Given a user with no organizations, When they sign in, Then they are redirected to `/organizations`
- **AC-010**: Given a user on the organizations page, When they create a new organization, Then they become the owner and are redirected to the dashboard
- **AC-011**: Given a pending invitation, When the user accepts it, Then they become a member of the organization and are redirected to the dashboard
- **AC-012**: Given an API key with `{ product: ['view'] }` permission, When a request is made to `GET /products`, Then the request succeeds with `200`
- **AC-013**: Given an API key with `{ product: ['view'] }` permission, When a request is made to `POST /products`, Then the request is denied with `403`
- **AC-014**: Given a custom role name matching a system role (e.g., "owner"), When `createRoleDto` validation runs, Then validation fails with "Cannot create a system role"
- **AC-015**: Given an attempt to delete a system role via the API, When `DELETE /roles/:id` is called, Then the request fails with `400: Cannot delete a system role`
- **AC-016**: Given an authenticated user navigating to `/products` without `product:view` permission, When the dashboard guard runs, Then they are redirected to `/`
- **AC-017**: Given a session query, When the data is fetched, Then it is cached for 5 minutes and not retried on failure
- **AC-018**: Given an API key created with metadata `{ userId: '...' }`, When the key is used, Then `_authType` is `'api_key'` and the `user` object is resolved from `metadata.userId`
- **AC-019**: Given the sign-in form, When submitted with invalid credentials, Then a server error message is displayed in Indonesian
- **AC-020**: Given the sign-up form, When passwords do not match, Then "Kata sandi tidak cocok." is displayed before the API call

## 6. Test Automation Strategy

- **Test Levels**: Integration tests for auth plugin macros, unit tests for permission utilities, integration tests for auth flows
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `auth.plugin.test.ts` testing `requireAuth`, `requireOrg`, `requirePermission` macros with Elysia's `app.handle(new Request(...))` pattern
- **Permission tests**: Test `getAllPermissions()`, `isValidPermission()`, `isSystemRole()` with edge cases (empty strings, invalid format, system role names)
- **Frontend tests**: Test session redirect logic in route `beforeLoad`, test `useHasPermission` hook with mocked permissions query
- **Auth flow tests**: Test sign-in -> session -> organization selection -> dashboard navigation; test API key creation and usage
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover all three auth macro paths (session auth, API key auth, no auth), all three system roles, custom role CRUD, permission validation edge cases

## 7. Rationale & Context

### Why better-auth?

better-auth provides a comprehensive, type-safe auth solution with first-class organization support and a plugin ecosystem. It handles session management, password hashing, email verification, and organization membership out of the box, reducing the need for custom auth code. The organization plugin provides dynamic access control that integrates with Prisma, enabling both system and custom roles.

### Why Two Auth Mechanisms (Session + API Key)?

Session-based auth is for interactive browser users (cookies, CSRF protection, organization context). API key auth is for machine-to-machine integrations (POS terminals, third-party services, webhooks) where browser sessions are not available. The `x-api-key` header approach follows industry convention (Stripe, OpenAI) and is easy to use from any HTTP client.

### Why `_authType` Discriminator?

Audit logging needs to know whether an action was performed by a human (session) or a machine (API key). The `_authType` discriminator enables the audit log to record this distinction without each route handler needing to figure it out independently.

### Why System Roles Cannot Be Modified?

System roles (`owner`, `admin`, `member`) define the baseline permission structure for every organization. Allowing modification would create inconsistent permission landscapes and potential security holes. Custom roles provide the flexibility needed for granular access control.

### Why Dynamic Access Control?

BearUang serves businesses of different sizes with different team structures. A small retail shop may only need the three system roles, while a larger business may need specialized roles like "warehouse_manager" or "cashier". Dynamic access control allows organizations to define custom roles at runtime without code changes.

### Why Permission Strings as `"resource:action"`?

The `resource:action` format is human-readable, easy to validate, and maps directly to the backend route permission declarations. It also works well with the frontend `useHasPermission()` hook and the dashboard `ROUTE_PERMISSION_MAP`.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for all auth-related tables (User, Session, Account, Organization, Member, Invitation, OrganizationRole, Apikey, Verification) via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** (`better-auth`) - Core authentication library providing session management, email/password auth, and organization plugin
- **SVC-002**: **better-auth organization plugin** (`better-auth/plugins/organization`) - Multi-tenant organization management with access control
- **SVC-003**: **better-auth API key plugin** (`@better-auth/api-key`) - Machine-to-machine authentication with rate limiting and scoped permissions
- **SVC-004**: **better-auth Prisma adapter** (`better-auth/adapters/prisma`) - Database adapter connecting better-auth to PostgreSQL via Prisma

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Every route module** - All business route plugins depend on `authPlugin` for authentication and authorization; auth is the most depended-upon module in the system
- **DAT-002**: **Audit logger** - Auth provides `_authType` and `user` context to all route handlers for audit logging

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework providing the macro system that powers `authPlugin`
- **PLT-002**: **Prisma ORM** - Database access layer for User, Session, Organization, Member, Invitation, OrganizationRole, Apikey models
- **PLT-003**: **TanStack Query** - Server state management for session and permissions caching on the frontend
- **PLT-004**: **TanStack Router** - File-based routing with `beforeLoad` guards for auth redirects
- **PLT-005**: **@elysiajs/eden** - Type-safe API client (Eden Treaty) that infers types from the Elysia app
- **PLT-006**: **better-auth/react** - React hooks (`useSession`, `useActiveOrganization`, `useListOrganizations`, `useActiveMember`) for frontend auth state

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations receive `_authType` and `userId` from the auth plugin for attribution

## 9. Examples & Edge Cases

### 9.1 Backend Route Using All Three Auth Macros

```typescript
import { Elysia } from 'elysia'
import { authPlugin } from '#plugins/auth.plugin'

const exampleRoute = new Elysia({ prefix: '/example', tags: ['Example'] })
  .use(authPlugin)
  .get('/', async ({ user, organization, _authType }) => {
    // user: { id, name, email, ... }
    // organization: { id, name, slug, members, invitations, ... }
    // _authType: 'session' | 'api_key'
    return { message: 'Hello' }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { product: ['view'] },
    detail: {
      summary: 'Example protected endpoint',
      description: 'Requires authentication, active organization, and product:view permission.',
    },
  })
```

### 9.2 API Key Authentication Flow (Backend)

```typescript
// When a request arrives with x-api-key header:
// 1. authPlugin.requireOrg resolves:
//    a. authenticate(headers) detects x-api-key
//    b. auth.api.verifyApiKey({ body: { key: apiKey } }) validates the key
//    c. result.key.referenceId provides the organizationId
//    d. result.key.metadata?.userId provides the user association
//    e. User is fetched from DB via prisma.user.findUnique
//    f. Full organization is fetched via fetchFullOrganization(organizationId)
//    g. Returns { user, session: null, organization, _authType: 'api_key' }

// When requirePermission is also applied:
// 2. auth.api.verifyApiKey({ body: { key: apiKey, permissions } }) checks
//    that the API key has the required permissions
//    If not: 403 Forbidden
```

### 9.3 Frontend Auth Flow (Sign In)

```typescript
// 1. User submits sign-in form
const { error } = await signIn.email({
  email: value.email,
  password: value.password,
  rememberMe: value.rememberMe,
})

// 2. On success: invalidate and refetch session
if (!error) {
  await queryClient.invalidateQueries({ queryKey: ['session'] })
  await queryClient.fetchQuery(sessionQueryOptions)
  await router.invalidate()
  router.navigate({ to: '/' })
}

// 3. Router handles redirect:
//    - _dashboard/route.tsx beforeLoad checks session
//    - If activeOrganizationId is null -> redirect to /organizations
//    - If activeOrganizationId exists -> render dashboard
```

### 9.4 Frontend Organization Switch Flow

```typescript
// 1. User clicks an organization card
await authClient.organization.setActive({ organizationId })

// 2. Invalidate and refetch session (now with new activeOrganizationId)
await queryClient.invalidateQueries({ queryKey: ['session'] })
await queryClient.fetchQuery(sessionQueryOptions)

// 3. Invalidate router cache to re-run all beforeLoad guards
await router.invalidate()

// 4. Navigate to dashboard
router.navigate({ to: '/' })
```

### 9.5 Custom Role CRUD Example

```typescript
// Create a custom role:
const { data } = await api.roles.post({
  body: {
    role: 'warehouse_manager',
    permissions: ['product:view', 'warehouse:create', 'warehouse:update', 'warehouse:view', 'stock:adjust', 'stock:view'],
  },
})

// The role is stored in OrganizationRole as:
// { id: 'uuid', organizationId: '...', role: 'warehouse_manager', permission: '{"product":["view"],"warehouse":["create","update","view"],"stock":["adjust","view"]}' }
```

### 9.6 Edge Cases

- **API key with no associated user**: If `metadata.userId` is not set on an API key, the `user` object will be `null`. The `authenticate()` function returns `null` in this case, causing a `401`. API keys must always include `metadata: { userId }` during creation.
- **Session with no active organization**: A newly signed-up user or a user who has been removed from all organizations will have `activeOrganizationId: null` on their session. The dashboard guard redirects them to `/organizations`.
- **Concurrent organization switches**: If a user switches organizations in two browser tabs simultaneously, the session will reflect the last switch. TanStack Query cache invalidation handles this by refetching the session on navigation.
- **Permission check on system roles**: System roles (owner, admin, member) bypass the `OrganizationRole` table lookup. The `GET /permissions` endpoint returns all permissions defined in the permission statement for system roles.
- **Custom role with empty permissions after removal**: If a custom role's permissions are reduced to empty, the role still exists but grants no access. Frontend forms prevent this by requiring `min(1)` permissions.
- **Expired API key**: The `Apikey.expiresAt` field is checked by better-auth during verification. Expired keys return `result.valid: false`, causing a `401`.
- **Rate-limited API key**: When the rate limit is exceeded (1000 requests/hour), better-auth returns an error. The `Apikey.remaining` field tracks the remaining quota.
- **Organization slug uniqueness**: Organization slugs must be globally unique (`@@unique([slug])`), not just within a user's scope. Creating an organization with a duplicate slug returns an error from better-auth.
- **Invitation for non-existent email**: better-auth handles invitation delivery. If the email does not correspond to an existing user, the invitation is still created and the user can sign up later.
- **Deleting the last owner**: If the only owner of an organization is deleted or removed, the organization becomes unmanaged. The better-auth organization plugin handles this at the application level.

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **Auth plugin usage**: All business route plugins use `.use(authPlugin)` and declare `requireAuth`, `requireOrg`, and `requirePermission` on every endpoint
2. **Auth context**: Route handlers destructure `{ user, organization, _authType }` from the context when using `requireOrg`
3. **API key metadata**: All created API keys include `metadata: { userId }` for audit trail attribution
4. **Permission model**: All permission checks use `requirePermission: { resource: ['action'] }` format matching the permission statement
5. **System role protection**: System roles cannot be created, modified, or deleted via the roles API
6. **Session caching**: Frontend session query uses `staleTime: 5 minutes` and `retry: false`
7. **Permission caching**: Frontend permissions query uses `staleTime: 5 minutes`
8. **Route guards**: Auth pages redirect authenticated users away; dashboard redirects unauthenticated users to sign-in; dashboard redirects users without active organization to organizations page
9. **Permission-gated UI**: Frontend uses `useHasPermission()` for UI element visibility and `ROUTE_PERMISSION_MAP` for route-level access
10. **Auth state sync**: After any auth state change, `['session']` and `['permissions']` query keys are invalidated and refetched
11. **Audit logging**: All write operations pass `_authType` and `userId` to `logAudit()`

## 11. Changelog (from previous version)

N/A -- This is the initial specification.

## 12. Related Specifications / Further Reading

- Auth integration: `packages/backend/src/integrations/auth.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Permissions library: `packages/backend/src/libraries/permissions.ts`
- Backend entry point (auth mounting): `packages/backend/src/index.ts`
- Frontend auth client: `packages/frontend/src/lib/auth-client.ts`
- Frontend session hook: `packages/frontend/src/lib/session.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Frontend permissions hook: `packages/frontend/src/lib/use-permissions.ts`
- Frontend sign-in route: `packages/frontend/src/routes/signin.tsx`
- Frontend sign-up route: `packages/frontend/src/routes/signup.tsx`
- Frontend organizations route: `packages/frontend/src/routes/organizations.tsx`
- Frontend dashboard guard: `packages/frontend/src/routes/_dashboard/route.tsx`
- API keys route: `packages/backend/src/modules/api-keys/api-keys.route.ts`
- API keys service: `packages/backend/src/modules/api-keys/api-keys.service.ts`
- Permissions route: `packages/backend/src/modules/permissions/permissions.route.ts`
- Roles route: `packages/backend/src/modules/roles/roles.route.ts`
- Roles service: `packages/backend/src/modules/roles/roles.service.ts`
- Prisma schema: `packages/backend/prisma/schema.prisma`
- API Keys specification: `specs/api-keys/spec-v1.md`
- Members specification: `specs/members/spec-v1.md`
- Invitations specification: `specs/invitations/spec-v1.md`
- Roles specification: `specs/roles/spec-v1.md`
- Permissions specification: `specs/permissions/spec-v1.md`
- better-auth documentation: https://www.better-auth.com
- better-auth organization plugin: https://www.better-auth.com/plugins/organization
- better-auth API key plugin: https://www.better-auth.com/docs/plugins/api-key
