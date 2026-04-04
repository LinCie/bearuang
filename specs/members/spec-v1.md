---
title: Members Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: members
tags: [members, organizations, roles, better-auth, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the members domain in BearUang. The members module manages organization membership — listing members, updating their roles, and removing them from an organization. It delegates read operations to Prisma and write operations (role changes, removal) to better-auth's organization plugin, ensuring that access control rules are enforced by the auth layer.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer with Prisma/better-auth delegation, and serialization patterns
- **Frontend module structure**: TanStack Query hooks (including invitation hooks co-located), React components, and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **Delegation model**: How the module splits reads (Prisma) from writes (better-auth)
- **Permission model**: How `member:view`, `member:update`, and `member:delete` permissions are enforced
- **Relationship to organizations**: How members relate to organizations and users via better-auth managed tables

**Audience**: Developers modifying the members domain, building organization settings pages, or implementing related modules (invitations, roles).

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, shadcn/ui, and better-auth's organization plugin.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Member** | A record linking a `User` to an `Organization` with a specific `role`; managed by better-auth's organization plugin |
| **Role** | A string identifier determining a member's permissions within an organization (e.g., `owner`, `admin`, `member`, or custom roles) |
| **System Role** | One of three built-in roles (`owner`, `admin`, `member`) that ship with better-auth and cannot be modified or deleted |
| **Custom Role** | A role created by an organization owner/admin with granular permission assignments, stored in `OrganizationRole` table |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic and data access (`{name}.service.ts`) |
| **Delegation** | Delegating operations to better-auth's `auth.api` for writes while using Prisma directly for reads |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings before API response |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for forms |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **Invitation** | A pending invite sent to an email address to join an organization with a specified role |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The module resides in `packages/backend/src/modules/members/` with `.route.ts` and `.service.ts` files
- **REQ-002**: Route plugin is an Elysia instance with `{ prefix: '/members', tags: ['Members'] }`
- **REQ-003**: Route plugin must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { member: ['action'] }` where actions are `view`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: `serializeMember` function converts Prisma Date type to ISO string before returning to client
- **REQ-009**: List queries are scoped by `organizationId` (no `deletedAt` filtering — members use hard delete via better-auth)
- **REQ-010**: Write operations (role update, remove) are delegated to better-auth's `auth.api.updateMemberRole` and `auth.api.removeMember`
- **REQ-011**: Write operations call `void logAudit(...)` with `model: 'Member'`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-014**: Role update and member removal pass the raw `request.headers` to better-auth for session validation

### 3.2 Service Layer

- **REQ-015**: Service is exported as an object literal: `export const membersService = { async method() {...} }`
- **REQ-016**: `listMembers` uses `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-017**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-018**: Search uses case-insensitive `contains` on `user.name` and `user.email` (nested relation search)
- **REQ-019**: `getMember` includes related `user` with selected fields `{ id, name, email, image }`
- **REQ-020**: `updateMemberRole` delegates to `auth.api.updateMemberRole({ headers, body: { memberId, role } })`
- **REQ-021**: `removeMember` delegates to `auth.api.removeMember({ headers, body: { memberIdOrEmail: memberId } })`
- **REQ-022**: Default `take` for list is `50` when no `pageSize` is specified

### 3.3 Frontend Architecture

- **REQ-023**: Module resides in `packages/frontend/src/modules/members/` with `hooks/`, `components/`, and `index.ts`
- **REQ-024**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-members.ts`
- **REQ-025**: Query key factories are defined in `hooks/use-members.ts` — both `memberKeys` and `invitationKeys` are co-located
- **REQ-026**: Cache invalidation targets `memberKeys.lists()` and `auditLogKeys.all` after mutations
- **REQ-027**: `InviteMemberSheet` uses shadcn `Sheet` component (slide-over, `sm:max-w-md`) with TanStack Form + Zod validation
- **REQ-028**: The invite form combines system roles (`owner`, `admin`, `member`) with custom roles fetched via `useRoles()`
- **REQ-029**: Permission-gated UI via `useHasPermission('member:action')`
- **REQ-030**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-031**: Form validation uses `validators.onBlur` and `validators.onSubmit` patterns
- **REQ-032**: The barrel export (`index.ts`) re-exports from both `hooks/` and `components/`

### 3.4 Database

- **REQ-033**: The `Member` model is managed by better-auth's organization plugin — primary key is a string ID (not UUID v7)
- **REQ-034**: `Member` has `organizationId` and `userId` foreign keys, both with `@@index`
- **REQ-035**: `Member.role` defaults to `"member"` and is a plain `String` field
- **REQ-036**: `Member` uses `onDelete: Cascade` on both `organization` and `user` relations
- **REQ-037**: Members use hard delete (managed by better-auth), not soft delete
- **REQ-038**: `User` model has `@@unique([email])` and maps to `user` table
- **REQ-039**: `OrganizationRole` stores custom role definitions with per-role permission grants

### 3.5 Constraints

- **CON-001**: better-auth manages the `Member`, `User`, `Session`, `Account`, `Organization`, and `OrganizationRole` tables — schema changes to these models must be made through better-auth's plugin API, not Prisma migrations directly
- **CON-002**: `updateMemberRole` and `removeMember` require forwarding raw HTTP headers (`request.headers`) to better-auth so it can validate the caller's session and permissions
- **CON-003**: better-auth's `removeMember` accepts `memberIdOrEmail` — the service always passes the member ID
- **CON-004**: better-auth enforces its own rules on role changes and removal (e.g., preventing last owner removal); the backend service does not duplicate these checks
- **CON-005**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-006**: The `member` permission does not include `create` — new members join via the invitations flow (`invitation:create`)
- **CON-007**: Search on the list endpoint filters by related `user.name` and `user.email`, requiring a Prisma relation filter (not a direct column filter)

### 3.6 Guidelines

- **GUD-001**: Co-locate invitation hooks and query keys with member hooks since they share the same domain context
- **GUD-002**: When adding new mutation hooks, always invalidate both `memberKeys.lists()` and `auditLogKeys.all`
- **GUD-003**: Use `paginatedResponse(memberSchema)` from `#common/pagination` for the list response shape
- **GUD-004**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-005**: Barrel export (`index.ts`) at every module/hooks/components directory level
- **GUD-006**: When extending the `InviteMemberSheet`, combine system roles and custom roles into a single options list via `useMemo`

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

#### Members

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/members` | List members (paginated, searchable) | `member:view` | `{ data: Member[], meta: PaginationMeta }` |
| GET | `/members/:id` | Get member detail (with user info) | `member:view` | `Member` or `404` |
| PATCH | `/members/:id` | Update member role | `member:update` | `Member` or `404` |
| DELETE | `/members/:id` | Remove member from organization | `member:delete` | `{ message }` or `404` |

### 4.2 Query Parameters (List Endpoint)

```typescript
interface ListMembersQuery {
  page: number;       // default: 1
  pageSize: number;   // default: 50
  sortBy?: 'role' | 'createdAt';  // sortable field name
  sortOrder?: 'asc' | 'desc';     // default: 'desc'
  search?: string;    // case-insensitive search on user.name and user.email
}
```

### 4.3 Response Shapes

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface ErrorResponse {
  message: string;
}
```

### 4.4 Zod Schema Definitions

#### Member

```typescript
const memberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullish(),
});

const memberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.iso.datetime(),
  userId: z.string(),
  user: memberUserSchema,
});

const updateMemberRoleDto = z.object({
  role: z.string().min(1),
});
```

#### Invitation (co-located in members hooks)

```typescript
const invitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  inviterId: z.string(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

const pendingInvitationSchema = invitationSchema.extend({
  organizationName: z.string(),
});

const createInvitationDto = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});
```

### 4.5 Prisma Models

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

model Organization {
  id          String       @id
  name        String
  slug        String
  logo        String?
  createdAt   DateTime
  metadata    String?
  members     Member[]
  invitations Invitation[]

  organizationroles OrganizationRole[]

  media Media[]

  @@unique([slug])
  @@map("organization")
}

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

### 4.6 Frontend Query Key Factories

```typescript
// members/hooks/use-members.ts
export const memberKeys = {
  all: ['members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (params: ListMembersQuery) => [...memberKeys.lists(), params] as const,
};

export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  list: (params: ListInvitationsQuery) => [...invitationKeys.lists(), params] as const,
};

export const myInvitationKeys = {
  all: ['my-invitations'] as const,
  pending: () => [...myInvitationKeys.all, 'pending'] as const,
};
```

### 4.7 Frontend Cache Invalidation Patterns

```typescript
// After updating a member role:
queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After removing a member:
queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After creating an invitation:
queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After cancelling an invitation:
queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
queryClient.invalidateQueries({ queryKey: auditLogKeys.all });

// After accepting an invitation:
queryClient.invalidateQueries({ queryKey: myInvitationKeys.all });
queryClient.invalidateQueries({ queryKey: ['session'] });
queryClient.invalidateQueries({ queryKey: ['organizations'] });

// After rejecting an invitation:
queryClient.invalidateQueries({ queryKey: myInvitationKeys.all });
```

### 4.8 Frontend Hook Exports

```typescript
// Query hooks
export function useMembers(params?: Partial<ListMembersQuery>): UseQueryResult
export function useInvitations(params?: Partial<ListInvitationsQuery>): UseQueryResult
export function useMyPendingInvitations(): UseQueryResult

// Mutation hooks
export function useCreateInvitation(): UseMutationResult
export function useCancelInvitation(): UseMutationResult
export function useAcceptInvitation(): UseMutationResult
export function useRejectInvitation(): UseMutationResult
export function useUpdateMemberRole(): UseMutationResult
export function useRemoveMember(): UseMutationResult

// Re-exported types
export type { Member, ListMembersQuery, UpdateMemberRoleInput }
export type { Invitation, PendingInvitation, CreateInvitationInput, ListInvitationsQuery }
```

### 4.9 Frontend Component Structure

```
modules/members/
  index.ts
  hooks/
    index.ts
    use-members.ts              # All member + invitation query/mutation hooks, query keys, type re-exports
  components/
    index.ts
    invite-member-sheet.tsx      # Sheet form: email input, role select (system + custom roles), submit/cancel
```

### 4.10 Frontend Component: InviteMemberSheet

```typescript
interface InviteMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { email: string; role: string }) => Promise<void>;
  isPending: boolean;
}
```

The component:
- Renders a shadcn `Sheet` (`side="right"`, `sm:max-w-md`) with title "Undang Anggota"
- Uses TanStack Form with Zod validation (`inviteSchema`) for email and role fields
- Combines three system roles (`member`, `admin`, `owner`) with custom roles from `useRoles()` hook
- Each role option has `value`, `label`, and `description` fields displayed in a `Select` component
- Shows validation errors inline below each field
- Displays server-side errors in a destructive-colored banner
- Resets form state when the sheet opens/closes
- Submit button shows "Mengirim..." loading state during submission

System role options:

| Value | Label | Description |
|-------|-------|-------------|
| `member` | Anggota | Akses dasar ke data organisasi |
| `admin` | Admin | Akses penuh kecuali pengaturan organisasi |
| `owner` | Pemilik | Akses penuh termasuk pengaturan organisasi |

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `member:view` permission, When they `GET /members`, Then they receive a paginated list of members scoped to their organization with serialized Date fields and included user data
- **AC-002**: Given an authenticated user with `member:view` permission, When they `GET /members/:id`, Then they receive the member detail with user info, or `404` if the member does not exist in the organization
- **AC-003**: Given an authenticated user with `member:update` permission, When they `PATCH /members/:id` with `{ role: "admin" }`, Then the member's role is updated via better-auth and the updated member is returned
- **AC-004**: Given an authenticated user with `member:delete` permission, When they `DELETE /members/:id`, Then the member is removed from the organization via better-auth and `{ message: "Member removed" }` is returned
- **AC-005**: Given a list request with `search=john`, When the query is executed, Then results are filtered by case-insensitive contains on both `user.name` and `user.email`
- **AC-006**: Given a role update or member removal that fails in better-auth, When the error is caught, Then a `404` with `{ message: "Member not found" }` is returned
- **AC-007**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-008**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-009**: Given the `InviteMemberSheet` is open, When a user submits with valid email and role, Then the `onSubmit` callback is called with the form values and the form resets on success
- **AC-010**: Given the `InviteMemberSheet` with custom roles available, When the role selector is opened, Then both system roles and custom roles are listed with their labels and descriptions
- **AC-011**: Given an audit-logged mutation, When a member role is updated or a member is removed, Then an audit log entry is written with `model: 'Member'` and the correct `operation`

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `members.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Use `prisma.$transaction` with rollback for isolated test data; mock better-auth `auth.api` for write operations
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths, error paths (404), permission checks, search filtering, role update delegation, member removal delegation
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test `InviteMemberSheet` with `render` + mock API responses

## 7. Rationale & Context

### Why Delegate Writes to better-auth?

The members module delegates role updates and member removal to better-auth's `auth.api` rather than writing directly to Prisma. This ensures that better-auth's access control logic is the single source of truth for membership operations. better-auth enforces rules such as preventing the last owner from being removed or having their role changed — duplicating these checks in the backend service would create drift risk. By delegating, the backend only needs to handle HTTP concerns (serialization, audit logging, error mapping) while better-auth handles business rules.

### Why Hard Delete Instead of Soft Delete?

Unlike product/domain entities that use soft delete for recoverability, members are managed entirely by better-auth. better-auth uses hard delete for membership records, which is appropriate because: (1) membership is a transient relationship that can be re-established via re-invitation, (2) the audit log preserves historical context of membership changes, and (3) better-auth's plugin API does not support soft delete semantics for member records.

### Why Co-locate Invitation Hooks with Member Hooks?

Invitations and members are tightly coupled — invitations are the entry point for new members, and invitation acceptance creates member records. Co-locating their query keys, hooks, and type exports in a single file (`use-members.ts`) keeps the membership lifecycle together and avoids cross-module imports for related operations.

### Why Include System Roles in the Invite Form?

The `InviteMemberSheet` hardcodes three system roles (`owner`, `admin`, `member`) alongside dynamically fetched custom roles. This provides a consistent baseline while allowing organizations to define granular custom roles. The `useRoles()` hook fetches custom roles from the roles module, and both sets are merged via `useMemo`.

### Why Forward Raw Headers to better-auth?

better-auth's `auth.api.updateMemberRole` and `auth.api.removeMember` require the original HTTP request headers to validate the caller's session cookie or bearer token. The Elysia route handler extracts `request.headers` and passes them directly to the service, which forwards them to better-auth. This preserves the authentication context for better-auth's internal authorization checks.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for member, user, organization, and invitation data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Manages member CRUD (role updates, removal), session management, and organization membership via the organization plugin. Provides `auth.api.updateMemberRole` and `auth.api.removeMember` endpoints
- **SVC-002**: **better-auth organization plugin** - Provides access control (`ac`), predefined roles (`owner`, `admin`, `member`), and dynamic access control for custom roles

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Invitations module** - Manages the invitation flow that creates new members; `use-members.ts` re-exports invitation types and hooks
- **DAT-002**: **Roles module** - Provides custom organization roles via `useRoles()` hook; the `InviteMemberSheet` fetches custom roles to populate the role selector
- **DAT-003**: **Audit logs module** - All member mutations invalidate `auditLogKeys.all` to reflect new audit entries

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer for member listing queries (reads only)
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Form** - Form state management for the invite member sheet
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Sheet, Select, Input, Label, Button)

### Compliance Dependencies
- **COM-001**: **Audit logging** - Role updates and member removals must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { membersService } from './members.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from '#common/pagination'

const memberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullish(),
})

const memberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.iso.datetime(),
  userId: z.string(),
  user: memberUserSchema,
})

const updateMemberRoleDto = z.object({
  role: z.string().min(1),
})

export const membersRoute = new Elysia({
  prefix: '/members',
  tags: ['Members'],
})
  .use(authPlugin)
  .get('/', async ({ organization, query }) => {
    const { page, pageSize, search, sortBy, sortOrder } = query
    const { skip, take } = paginationToSkipTake(page, pageSize)
    const { data, total } = await membersService.listMembers(
      organization.id,
      {
        skip, take, search,
        orderBy: sortBy ? { field: sortBy, order: sortOrder ?? 'desc' } : undefined,
      },
    )
    return {
      data: data.map(serializeMember),
      meta: buildPaginationMeta(total, page, pageSize),
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { member: ['view'] },
    query: listMembersQuery,
    response: { 200: paginatedResponse(memberSchema) },
    detail: { summary: 'List members', description: '...' },
  })
  .patch('/:id', async ({ _authType, organization, user, request, params, body, status }) => {
    try {
      const member = await membersService.updateMemberRole(request.headers, params.id, body.role)
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Member',
        operation: 'update',
        args: { id: params.id, data: body },
      })
      return serializeMember(member)
    } catch {
      return status(404, { message: 'Member not found' })
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { member: ['update'] },
    params: memberIdParam,
    body: updateMemberRoleDto,
    response: { 200: memberSchema, 404: errorResponse },
    detail: { summary: "Update a member's role", description: '...' },
  })
  .delete('/:id', async ({ _authType, organization, user, request, params, status }) => {
    try {
      await membersService.removeMember(request.headers, params.id)
      void logAudit({
        organizationId: organization.id,
        userId: user.id,
        authType: _authType,
        model: 'Member',
        operation: 'delete',
        args: { id: params.id },
      })
      return status(200, { message: 'Member removed' })
    } catch {
      return status(404, { message: 'Member not found' })
    }
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { member: ['delete'] },
    params: memberIdParam,
    response: { 200: errorResponse, 404: errorResponse },
    detail: { summary: 'Remove a member', description: '...' },
  })
```

### 9.2 Backend Service (Read vs Write Delegation)

```typescript
import { prisma } from '#integrations/prisma'
import { auth } from '#integrations/auth'

export const membersService = {
  // READ: Direct Prisma query (fast, scoped by organizationId)
  async listMembers(organizationId: string, params?: { skip?: number; take?: number; search?: string; orderBy?: { field: 'role' | 'createdAt'; order: 'asc' | 'desc' } }) {
    const where = {
      organizationId,
      ...(params?.search && {
        OR: [
          { user: { name: { contains: params.search, mode: 'insensitive' } } },
          { user: { email: { contains: params.search, mode: 'insensitive' } } },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy ? { [params.orderBy.field]: params.orderBy.order } : { createdAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ])
    return { data, total }
  },

  // READ: Direct Prisma query
  async getMember(organizationId: string, id: string) {
    return prisma.member.findFirst({
      where: { id, organizationId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })
  },

  // WRITE: Delegated to better-auth (enforces access control)
  async updateMemberRole(headers: Headers, memberId: string, role: string) {
    return auth.api.updateMemberRole({ headers, body: { memberId, role } })
  },

  // WRITE: Delegated to better-auth (enforces access control)
  async removeMember(headers: Headers, memberId: string) {
    return auth.api.removeMember({ headers, body: { memberIdOrEmail: memberId } })
  },
}
```

### 9.3 Edge Cases

- **Last owner removal protection**: better-auth prevents removing the last owner from an organization; the backend catches this as a generic error and returns `404` — consumers should be aware that the actual error may be a business rule violation, not a missing record
- **Self-removal**: better-auth handles the case where a user attempts to remove themselves; the behavior depends on better-auth's internal rules (e.g., an owner cannot remove themselves if they are the last owner)
- **Search across relation**: The `search` parameter filters on `user.name` and `user.email` (nested Prisma relation), not on the member record itself — this requires the `include` clause to always be present in list queries
- **Role string validation**: The backend accepts any non-empty string as a role (`z.string().min(1)`); validation against valid system or custom roles is handled by better-auth, not by the Zod schema
- **Custom roles in invite form**: If the roles module is unreachable or returns an error, `useRoles()` returns `undefined` and only system roles are displayed — the invite form remains functional without custom roles
- **Header forwarding**: The service methods for write operations require `Headers` from the original request; these cannot be reconstructed after the request lifecycle ends

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/members/` with `.route.ts` and `.service.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`
3. **Delegation model**: Read operations (list, get) use Prisma directly; write operations (update role, remove) delegate to better-auth `auth.api`
4. **Serialization**: All Date fields return ISO 8601 strings; user image field returns `null` when absent
5. **Pagination**: List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder`, `search`; return `{ data, meta }`
6. **Audit logging**: Role updates and member removals call `void logAudit(...)` with `model: 'Member'`
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factories with `memberKeys`, `invitationKeys`, and `myInvitationKeys`
9. **Cache invalidation**: Mutations invalidate `memberKeys.lists()` and `auditLogKeys.all`; invitation mutations additionally invalidate `invitationKeys.lists()`; acceptance invalidates `session` and `organizations`
10. **Indonesian UI**: All user-facing text in `InviteMemberSheet` is in Bahasa Indonesia
11. **Permission guards**: Role update and removal UI elements gated by `useHasPermission('member:update')` and `useHasPermission('member:delete')`
12. **Co-located hooks**: Member and invitation query keys, hooks, and types are co-located in `hooks/use-members.ts`

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Auth integration: `packages/backend/src/integrations/auth.ts`
- Permissions library: `packages/backend/src/libraries/permissions.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Invitations module: `packages/backend/src/modules/invitations/`, `packages/frontend/src/modules/invitations/`
- Roles module: `packages/backend/src/modules/roles/`, `packages/frontend/src/modules/roles/`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Products spec (reference template): `specs/products/spec-v1.md`
