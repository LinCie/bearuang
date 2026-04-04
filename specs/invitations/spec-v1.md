---
title: Invitations Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: invitations
tags: [invitations, organization, members, better-auth, elysia, prisma, react, tanstack]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the invitations domain in BearUang. It covers the **Invitation** resource used to invite users to join an organization. The module delegates core invitation management (create, cancel, accept, reject) to **better-auth**'s organization plugin, while providing organization-scoped listing, permission-gated access, and serialization through a custom Elysia route layer. Frontend hooks and the invite form component are **co-located within the members module** rather than a standalone invitations module.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin, service layer delegating to better-auth, Prisma model, and serialization patterns
- **Frontend module structure**: TanStack Query hooks and React components co-located inside `modules/members/`
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **better-auth delegation**: How create, cancel, accept, and reject operations proxy to better-auth's organization API
- **Invitation lifecycle**: Pending -> accepted / rejected / expired / cancelled states
- **Conventions**: file naming, code organization, permission model, audit logging

**Audience**: Developers building new modules or modifying the invitations / members domain.

**Assumptions**: The reader is familiar with Elysia.js, Prisma ORM, TanStack Query, TanStack Router, shadcn/ui, and better-auth's organization plugin.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Invitation** | A record representing an invitation to join an organization, managed by better-auth's organization plugin |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for a resource (`{name}.route.ts`) |
| **Service** | An object literal containing business logic, delegating write operations to better-auth and read operations to Prisma (`{name}.service.ts`) |
| **Serialize** | Converting Prisma Date types to JSON-safe ISO strings before API response |
| **better-auth Delegation** | Write operations (create, cancel, accept, reject) are forwarded to `auth.api.*Invitation()` which handles the actual DB writes |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for the invite member form |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for a resource |
| **Co-location** | Invitation frontend hooks and components live inside `modules/members/` rather than a separate `modules/invitations/` directory |
| **Hyphenated route** | `my-pending` requires bracket notation in Eden client: `api.invitations['my-pending']` |
| **Invitation lifecycle** | The state machine an invitation follows: `pending` -> `accepted` / `rejected` / `cancelled` / `expired` |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The invitations module resides in `packages/backend/src/modules/invitations/` with `invitations.route.ts` and `invitations.service.ts`
- **REQ-002**: The route plugin is an Elysia instance with `{ prefix: '/invitations', tags: ['Invitations'] }`
- **REQ-003**: All route plugins must use `authPlugin` (`.use(authPlugin)`)
- **REQ-004**: Organization-scoped endpoints (list, get, create, cancel) must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { invitation: ['view'] }`, `requirePermission: { invitation: ['create'] }`, `requirePermission: { invitation: ['delete'] }`
- **REQ-006**: User-scoped endpoints (accept, reject, my-pending) require `requireAuth: true` but not `requireOrg: true` since the user may not yet be a member of the inviting organization
- **REQ-007**: Zod schemas define request validation (body, query, params) and response shapes
- **REQ-008**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-009**: `serializeInvitation()` and `serializePendingInvitation()` convert Prisma Date types to ISO strings before returning to client
- **REQ-010**: All write operations (create, accept, reject, cancel) delegate to better-auth via `auth.api.createInvitation()`, `auth.api.cancelInvitation()`, `auth.api.acceptInvitation()`, `auth.api.rejectInvitation()` — passing the raw `Headers` object
- **REQ-011**: All write operations call `void logAudit(...)` with `model: 'Invitation'`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-012**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-013**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-014**: better-auth errors (invalid invitation, already accepted, expired) are caught and returned as `400` with `{ message: string }`

### 3.2 Service Layer

- **REQ-015**: The service is exported as an object literal: `export const invitationsService = { async method() {...} }`
- **REQ-016**: List endpoint uses `prisma.$transaction([findMany, count])` to return `{ data, total }`
- **REQ-017**: Pagination uses `paginationToSkipTake(page, pageSize)` to compute `skip` and `take`
- **REQ-018**: Search uses case-insensitive `contains` on the `email` field
- **REQ-019**: Status filtering is supported via the `status` query parameter (e.g., `status=pending`)
- **REQ-020**: Default sort order is `createdAt: 'desc'`; sortable fields are `status`, `createdAt`, `email`
- **REQ-021**: Create, cancel, accept, and reject operations forward to `auth.api.*Invitation({ headers, body })` — the service does not write to Prisma directly for these operations
- **REQ-022**: The pending invitations query (`getPendingInvitationsForUser`) uses direct Prisma access with `include: { organization: { select: { name: true } } }` and filters by `status: 'pending'`

### 3.3 Frontend Architecture

- **REQ-023**: Invitation frontend code is co-located within `packages/frontend/src/modules/members/` — hooks in `hooks/use-members.ts`, components in `components/invite-member-sheet.tsx`
- **REQ-024**: TanStack Query hooks wrap Eden Treaty API calls; invitation hooks are exported from `hooks/use-members.ts` alongside member hooks
- **REQ-025**: Query key factories are defined in `hooks/use-members.ts`: `invitationKeys` for org-scoped queries, `myInvitationKeys` for user-scoped pending queries
- **REQ-026**: Cache invalidation targets the correct query key scope after mutations; invitation mutations also invalidate `auditLogKeys.all`
- **REQ-027**: The invite form uses TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-028**: The invite form uses shadcn `Sheet` component (slide-over, `sm:max-w-md`)
- **REQ-029**: Cancel invitation confirmations use shadcn `Dialog`
- **REQ-030**: Permission-gated UI via `useHasPermission('invitation:create')` for the invite button
- **REQ-031**: All UI text is in Indonesian (Bahasa Indonesia)
- **REQ-032**: Role selection in the invite form combines system roles (owner, admin, member) with custom roles fetched from `useRoles()`

### 3.4 Database

- **REQ-033**: The Invitation model uses better-auth's default `@id` (string, managed by better-auth)
- **REQ-034**: The Invitation model has `organizationId` field with an index for multi-tenant scoping
- **REQ-035**: The Invitation model has `email` field with an index for lookup by invited user
- **REQ-036**: The Invitation model uses `@@map("invitation")` for database table naming
- **REQ-037**: The Invitation model has `onDelete: Cascade` on both `organization` and `user` (inviter) relations

### 3.5 Constraints

- **CON-001**: The invitations module does **not** follow the standard `deletedAt` soft-delete pattern — cancelled/expired invitations retain their record with a `status` field change, not a deletion
- **CON-002**: better-auth manages the Invitation table schema and writes; the custom service layer only reads and delegates writes
- **CON-003**: The `accept` and `reject` endpoints require `requireAuth: true` but intentionally omit `requireOrg: true` because the inviting organization may differ from the user's active organization
- **CON-004**: The `my-pending` endpoint uses a hyphenated path segment (`/my-pending`), requiring bracket notation in the Eden client: `api.invitations['my-pending']`
- **CON-005**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-006**: The accept endpoint's response includes both the updated `invitation` and the newly created `member` record, requiring a composite response schema
- **CON-007**: Invitation roles are cast from `string` to `'member' | 'admin' | 'owner'` in the service layer for better-auth compatibility

### 3.6 Guidelines

- **GUD-001**: The Invitation model is owned by better-auth — avoid direct Prisma writes (create, update, delete) outside of the `auth.api.*Invitation()` methods
- **GUD-002**: Prefer reading invitations directly from Prisma (as the service does for list, get, and pending queries) since better-auth's API requires request headers for write operations
- **GUD-003**: Use `paginatedResponse(schema)` from `#common/pagination` for all list response shapes
- **GUD-004**: Use `errorResponse` from `#common/error.response` for all error response shapes
- **GUD-005**: Consider extracting invitation hooks to a standalone `modules/invitations/` directory if the invitation feature grows beyond the current scope (e.g., bulk invite, invitation settings, email customization)
- **GUD-006**: The invite form component (`invite-member-sheet.tsx`) combines system roles with custom roles — keep this pattern consistent if new system roles are added

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| GET | `/invitations` | List invitations (paginated, searchable, filterable by status) | `invitation:view` | `{ data: Invitation[], meta: PaginationMeta }` |
| POST | `/invitations` | Create invitation (delegates to better-auth) | `invitation:create` | `201 Invitation` or `400` |
| GET | `/invitations/my-pending` | Get pending invitations for the authenticated user | Auth required (no org) | `{ data: PendingInvitation[] }` |
| GET | `/invitations/:id` | Get invitation detail | `invitation:view` | `Invitation` or `404` |
| POST | `/invitations/:id/accept` | Accept invitation (delegates to better-auth) | Auth required (no org) | `{ invitation, member }` or `400` |
| POST | `/invitations/:id/reject` | Reject invitation (delegates to better-auth) | Auth required (no org) | `{ invitation }` or `400` |
| DELETE | `/invitations/:id` | Cancel invitation (delegates to better-auth) | `invitation:delete` | `{ message }` or `404` |

### 4.2 Query Parameters (List Endpoints)

```typescript
interface ListInvitationsQuery {
  page: number;       // default: 1
  pageSize: number;   // default: 10
  sortBy?: 'status' | 'createdAt' | 'email';
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
  search?: string;    // case-insensitive search on email
  status?: string;    // filter by invitation status (e.g., 'pending', 'accepted', 'cancelled')
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

interface AcceptInvitationResponse {
  invitation: Invitation | null;
  member: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: string;  // ISO 8601
  } | null;
}

interface RejectInvitationResponse {
  invitation: Invitation | null;
}

interface MyPendingInvitationsResponse {
  data: PendingInvitation[];
}
```

### 4.4 Zod Schema Definitions

#### Invitation

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

const createInvitationDto = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

const invitationIdParam = z.object({
  id: z.string(),
});
```

#### Pending Invitation (extended with organization name)

```typescript
const pendingInvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  inviterId: z.string(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  organizationName: z.string(),
});
```

#### List Query

```typescript
const listInvitationsQuery = paginationQuery
  .extend(sortQuery(['status', 'createdAt', 'email']).shape)
  .extend({
    search: z.string().optional(),
    status: z.string().optional(),
  });
```

#### Invite Form (Frontend Zod)

```typescript
const inviteSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  role: z.string().min(1, 'Peran wajib dipilih'),
});
```

### 4.5 Prisma Models

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

### 4.6 Invitation Lifecycle

```
                    ┌──────────┐
  POST /invitations │ pending  │
  ─────────────────►│          │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┬──────────────┐
          │              │              │              │
          ▼              ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ accepted │  │ rejected │  │cancelled │  │ expired  │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
          │                           │
    POST /:id/accept            DELETE /:id
    (creates Member)            (requires invitation:delete)
          │
          ▼
    POST /:id/reject
```

- **pending**: Initial state after creation. The invitation is awaiting a response from the invited user.
- **accepted**: The user accepted the invitation via `POST /:id/accept`. A `Member` record is created automatically by better-auth.
- **rejected**: The user rejected the invitation via `POST /:id/reject`.
- **cancelled**: An organization member with `invitation:delete` permission cancelled the invitation via `DELETE /:id`.
- **expired**: The invitation passed its `expiresAt` timestamp without being acted upon (managed by better-auth internally).

### 4.7 Frontend Query Key Factories

```typescript
// members/hooks/use-members.ts
export const invitationKeys = {
  all: ['invitations'] as const,
  lists: () => [...invitationKeys.all, 'list'] as const,
  list: (params: ListInvitationsQuery) =>
    [...invitationKeys.lists(), params] as const,
};

export const myInvitationKeys = {
  all: ['my-invitations'] as const,
  pending: () => [...myInvitationKeys.all, 'pending'] as const,
};
```

### 4.8 Frontend Cache Invalidation Patterns

```typescript
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

### 4.9 Frontend Route Structure

```
_dashboard/
  members/
    index.tsx                    # Members list page (DataTable + invitation section + invite button)
organizations.tsx                 # Organization switcher page with pending invitation cards
```

There is no standalone `_dashboard/invitations/` route directory. Invitation management is rendered inline within the members page and the organization switcher page.

### 4.10 Frontend Component Structure

```
modules/members/
  index.ts                        # Barrel export: hooks + components
  hooks/
    index.ts                      # Barrel export: use-members
    use-members.ts                # All member + invitation query & mutation hooks
  components/
    index.ts                      # Barrel export: invite-member-sheet
    invite-member-sheet.tsx       # Sheet form: email input, role select (system + custom roles)
```

### 4.11 Frontend Hook Exports

```typescript
// Organization-scoped invitation hooks
export function useInvitations(params?: Partial<ListInvitationsQuery>): UseQueryResult
export function useCreateInvitation(): UseMutationResult<Invitation, Error, CreateInvitationInput>
export function useCancelInvitation(): UseMutationResult<{ message: string }, Error, string>

// User-scoped invitation hooks
export function useMyPendingInvitations(): UseQueryResult<{ data: PendingInvitation[] }>
export function useAcceptInvitation(): UseMutationResult<AcceptInvitationResponse, Error, string>
export function useRejectInvitation(): UseMutationResult<{ invitation: Invitation | null }, Error, string>
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `invitation:view` permission, When they `GET /invitations`, Then they receive a paginated list of invitations scoped to their organization with serialized ISO date fields
- **AC-002**: Given an authenticated user with `invitation:create` permission, When they `POST /invitations` with a valid email and role, Then better-auth creates the invitation (201) and an audit log entry is written
- **AC-003**: Given an authenticated user with `invitation:delete` permission, When they `DELETE /invitations/:id`, Then better-auth cancels the invitation and an audit log entry is written
- **AC-004**: Given a valid pending invitation, When the invited user calls `POST /invitations/:id/accept`, Then the invitation status changes to `accepted`, a `Member` record is created, and the response includes both the updated invitation and the new member
- **AC-005**: Given a valid pending invitation, When the invited user calls `POST /invitations/:id/reject`, Then the invitation status changes to `rejected` and the response includes the updated invitation
- **AC-006**: Given an authenticated user, When they `GET /invitations/my-pending`, Then they receive all pending invitations for their email address including the organization name
- **AC-007**: Given a list endpoint, When `search` query parameter is provided, Then results are filtered by case-insensitive contains on the `email` field
- **AC-008**: Given a list endpoint, When `status` query parameter is provided, Then results are filtered by the exact status value
- **AC-009**: Given an unauthenticated request, When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-010**: Given a user without the required permission, When an organization-scoped endpoint is called, Then a `403 Forbidden` is returned
- **AC-011**: Given an invitation that does not exist or is already accepted, When accept/reject/cancel is called, Then a `400` error is returned with a descriptive message
- **AC-012**: Given the frontend members page, When a user with `invitation:create` permission clicks the invite button, Then the invite sheet opens with email and role fields
- **AC-013**: Given the frontend invite sheet, When a user submits with an invalid email, Then a client-side validation error is shown in Bahasa Indonesia
- **AC-014**: Given the organization switcher page, When the user has pending invitations, Then each invitation is displayed as a card with the organization name, role, date, and accept/reject actions
- **AC-015**: Given an invitation accept or cancel, When the mutation succeeds, Then the members list and audit logs are invalidated and refreshed

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service delegation, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `invitations.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Use `prisma.$transaction` with rollback for isolated test data; mock `auth.api.*Invitation()` for write operation tests
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths for all 7 endpoints, error paths (400, 404, 403), permission checks, invitation lifecycle transitions (pending -> accepted, pending -> rejected, pending -> cancelled)
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test `invite-member-sheet` component with `render` + mock API responses

## 7. Rationale & Context

### Why Delegate to better-auth for Write Operations?

The Invitation model is owned by better-auth's organization plugin. better-auth manages invitation creation (including email sending, expiration, and duplicate detection), acceptance (including Member record creation), rejection, and cancellation. Delegating write operations to `auth.api.*Invitation()` ensures consistency with better-auth's internal logic and avoids duplicating business rules. The custom route layer provides organization-scoped listing, permission enforcement, serialization, and audit logging on top of better-auth's capabilities.

### Why No Soft Delete on Invitations?

Unlike product data, invitations are transient records with a natural lifecycle managed by status transitions (pending -> accepted/rejected/cancelled/expired). There is no `deletedAt` field. Cancelled or expired invitations remain in the database for audit trail purposes and are filtered by status rather than deletion.

### Why No `requireOrg` on Accept/Reject?

When a user accepts an invitation, they may not yet be a member of the inviting organization. The `requireOrg` middleware would reject the request since the user has no membership in that organization. Therefore, accept and reject endpoints only require authentication (`requireAuth: true`).

### Why Co-locate Frontend Code with Members?

Invitations are tightly coupled with the members domain — an accepted invitation creates a member, cancelled invitations are managed from the members page, and the invite form is conceptually "add a member". Co-locating the invitation hooks and the invite form component within the members module reduces cross-module imports and keeps related code together. If the invitation feature grows significantly (bulk invite, email templates, settings), it should be extracted to a standalone `modules/invitations/` directory.

### Why Separate `myInvitationKeys` from `invitationKeys`?

Organization-scoped invitation queries (`invitationKeys`) and user-scoped pending invitation queries (`myInvitationKeys`) have different invalidation triggers. Accepting an invitation invalidates `myInvitationKeys`, `['session']`, and `['organizations']` (because the user gains a new organization membership) but not `invitationKeys` (which belongs to the inviting organization). Keeping them separate ensures correct cache behavior.

### Why Indonesian UI Text?

BearUang targets Indonesian businesses (bearuang = "bear money" in Indonesian). All user-facing text is in Bahasa Indonesia for the target audience.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Primary data store for invitation data via Prisma ORM

### Third-Party Services
- **SVC-001**: **better-auth** - Organization plugin provides invitation CRUD API (`auth.api.createInvitation`, `auth.api.cancelInvitation`, `auth.api.acceptInvitation`, `auth.api.rejectInvitation`); manages Invitation table schema, email sending, expiration, and Member creation on accept
- **SVC-002**: **better-auth access control** - Permission enforcement via `ac`, `owner`, `admin`, `member` roles defined in `#libraries/permissions`

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Member** - Created automatically by better-auth when an invitation is accepted; the accept endpoint response includes the new member record
- **DAT-002**: **Organization** - Invitations are scoped to an organization; the `my-pending` endpoint includes the organization name via Prisma `include`
- **DAT-003**: **AuditLog** - All write operations (create, accept, reject, cancel) must be logged with user identity and operation details
- **DAT-004**: **OrganizationRole** - Custom roles from the roles module are available in the invite form role selector

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with TypeBox/Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer for reading invitations; schema managed by better-auth
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Router** - File-based routing; invitation UI rendered in `_dashboard/members/index.tsx` and `organizations.tsx`
- **PLT-005**: **TanStack Form** - Form state management for the invite member sheet
- **PLT-006**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Select, Button, Input)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, accept, reject, cancel) must be logged with user identity and operation details

## 9. Examples & Edge Cases

### 9.1 Backend Route: Create Invitation (Delegation to better-auth)

```typescript
.post('/', async ({ _authType, organization, user, request, body, status }) => {
  try {
    const invitation = await invitationsService.createInvitation(
      request.headers,
      body,
    )
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'Invitation',
      operation: 'create',
      args: { data: body },
    })
    return status(201, serializeInvitation(invitation as unknown as InvitationData))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create invitation'
    return status(400, { message })
  }
}, {
  requireAuth: true,
  requireOrg: true,
  requirePermission: { invitation: ['create'] },
  body: createInvitationDto,
  response: { 201: invitationSchema, 400: errorResponse },
  detail: {
    summary: 'Create an invitation',
    description: 'Sends an invitation to join the authenticated organization with the specified role.',
  },
})
```

### 9.2 Backend Service: Delegation Pattern

```typescript
async createInvitation(headers: Headers, data: { email: string; role: string }) {
  return auth.api.createInvitation({
    headers,
    body: {
      email: data.email,
      role: data.role as 'member' | 'admin' | 'owner',
    },
  })
}

async cancelInvitation(headers: Headers, invitationId: string) {
  return auth.api.cancelInvitation({
    headers,
    body: { invitationId },
  })
}

async acceptInvitation(headers: Headers, invitationId: string) {
  return auth.api.acceptInvitation({
    headers,
    body: { invitationId },
  })
}

async rejectInvitation(headers: Headers, invitationId: string) {
  return auth.api.rejectInvitation({
    headers,
    body: { invitationId },
  })
}
```

### 9.3 Backend Service: Direct Prisma Read

```typescript
async listInvitations(organizationId: string, params?: {
  skip?: number; take?: number; search?: string; status?: string;
  orderBy?: { field: 'status' | 'createdAt' | 'email'; order: 'asc' | 'desc' };
}) {
  const where = {
    organizationId,
    ...(params?.status && { status: params.status }),
    ...(params?.search && {
      OR: [{ email: { contains: params.search, mode: 'insensitive' as const } }],
    }),
  }
  const [data, total] = await prisma.$transaction([
    prisma.invitation.findMany({
      where,
      skip: params?.skip,
      take: params?.take ?? 50,
      orderBy: params?.orderBy
        ? { [params.orderBy.field]: params.orderBy.order }
        : { createdAt: 'desc' },
    }),
    prisma.invitation.count({ where }),
  ])
  return { data, total }
}

async getPendingInvitationsForUser(email: string) {
  return prisma.invitation.findMany({
    where: { email, status: 'pending' },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
```

### 9.4 Frontend Hook: Eden Client with Hyphenated Route

```typescript
export function useMyPendingInvitations() {
  return useQuery({
    queryKey: myInvitationKeys.pending(),
    queryFn: async () => {
      // Bracket notation required for hyphenated route segment
      const { data, error } = await api.invitations['my-pending'].get()
      if (error) throw error
      return data
    },
  })
}
```

### 9.5 Frontend Invite Form Role Selector

```typescript
const systemRoleOptions: RoleOption[] = [
  { value: 'member', label: 'Anggota', description: 'Akses dasar ke data organisasi' },
  { value: 'admin', label: 'Admin', description: 'Akses penuh kecuali pengaturan organisasi' },
  { value: 'owner', label: 'Pemilik', description: 'Akses penuh termasuk pengaturan organisasi' },
]

// Combined with custom roles from useRoles()
const allRoleOptions = React.useMemo(() => {
  const options = [...systemRoleOptions]
  if (customRoles) {
    for (const role of customRoles) {
      options.push({
        value: role.role,
        label: role.role,
        description: `${role.permissions.length} izin kustom`,
      })
    }
  }
  return options
}, [customRoles])
```

### 9.6 Edge Cases

- **Duplicate invitation**: better-auth handles duplicate email invitations within the same organization and returns an appropriate error, which is caught and returned as `400`
- **Accept with wrong auth context**: The accept endpoint omits `requireOrg` because the user may not be a member of the inviting organization yet. The request headers are forwarded to better-auth which validates the invitation ownership
- **Cancel someone else's invitation**: Only users with `invitation:delete` permission in the organization can cancel invitations. The `requireOrg` middleware ensures the invitation belongs to the user's active organization
- **Expired invitation acceptance**: better-auth rejects acceptance of expired invitations; the error is caught and returned as `400`
- **Accept/reject cache invalidation**: Accepting an invitation invalidates `myInvitationKeys`, `['session']`, and `['organizations']` because the user gains a new organization membership, which changes session data and the organization list
- **Custom roles in invite form**: The invite form fetches custom roles via `useRoles()` and combines them with system roles. If the roles module is unavailable, only system roles are shown
- **Self-invitation**: better-auth may allow or prevent a user from inviting themselves depending on its configuration; the current setup does not add explicit client-side validation for this

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: Backend has `modules/invitations/` with `.route.ts` and `.service.ts`; frontend has invitation hooks in `modules/members/hooks/` and invite form in `modules/members/components/`
2. **Auth & permissions**: Organization-scoped endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission`; user-scoped endpoints use `requireAuth` only
3. **Serialization**: All Date fields return ISO 8601 strings via `serializeInvitation()` and `serializePendingInvitation()`
4. **better-auth delegation**: Create, cancel, accept, and reject operations forward to `auth.api.*Invitation()` with the raw request headers
5. **Pagination**: List endpoint accepts `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `status`; returns `{ data, meta }`
6. **Audit logging**: All write operations call `void logAudit(...)` with `model: 'Invitation'`, correct operation name, and args
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `invitationKeys` (org-scoped) and `myInvitationKeys` (user-scoped)
9. **Cache invalidation**: Mutations invalidate the correct query key scopes including cross-module dependencies (`auditLogKeys`, `['session']`, `['organizations']`)
10. **Indonesian UI**: All user-facing text is in Bahasa Indonesia
11. **Permission guards**: Create and cancel UI elements gated by `useHasPermission('invitation:create')` and `useHasPermission('invitation:delete')`
12. **Error handling**: better-auth errors are caught and returned as `400` with descriptive messages; not-found returns `404`

## 11. Changelog (from previous version)

N/A - This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend shared utilities: `packages/backend/src/common/pagination.ts`, `packages/backend/src/common/error.response.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Auth integration: `packages/backend/src/integrations/auth.ts` (better-auth configuration with organization plugin)
- Permissions: `packages/backend/src/libraries/permissions.ts` (access control statements for `invitation` resource)
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Members module spec: `specs/members/spec-v1.md` (frontend co-location context)
- Frontend API client: `packages/frontend/src/lib/api.ts`
- Frontend auth client: `packages/frontend/src/lib/auth-client.ts`
- Frontend permissions hook: `packages/frontend/src/lib/use-permissions.ts`
- DataTable component: `packages/frontend/src/components/ui/data-table.tsx`
- Roles module: `packages/frontend/src/modules/roles/` (custom roles used in invite form)
- Members route: `packages/frontend/src/routes/_dashboard/members/index.tsx`
- Organizations route: `packages/frontend/src/routes/organizations.tsx` (pending invitation cards)
