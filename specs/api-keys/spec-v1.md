---
title: API Keys Module Specification
version: v1
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Backend & Frontend Teams
feature: api-keys
tags: [api-keys, better-auth, elysia, prisma, react, tanstack, permissions]
---

# Introduction

This specification documents the architecture, conventions, and data contracts for the API keys domain in BearUang. Unlike standard CRUD modules that use direct Prisma access, the API keys module **wraps better-auth's `@better-auth/api-key` plugin** — delegating key creation, listing, updating, and deletion to better-auth's internal API while adding an Elysia route layer for organization scoping, permission enforcement, audit logging, and serialization.

## 1. Purpose & Scope

This specification defines:

- **Backend module structure**: Elysia route plugin wrapping better-auth API key endpoints, service layer, Prisma model, and serialization patterns
- **Frontend module structure**: TanStack Query hooks, React components (form sheet, delete dialog), and UI patterns
- **API contracts**: HTTP endpoints, request/response schemas, error handling
- **better-auth integration**: How the `@better-auth/api-key` plugin is configured, how the service layer proxies calls, and how API keys are used for authentication via `authPlugin`
- **Permission model**: How API keys carry scoped permissions and how those are enforced at the route level

**Audience**: Developers modifying the API keys domain or building integrations that authenticate via API keys.

**Assumptions**: The reader is familiar with Elysia.js, better-auth (including its organization and API key plugins), Prisma ORM, TanStack Query, TanStack Router, and shadcn/ui.

## 2. Definitions

| Term | Definition |
|------|-----------|
| **API Key** | A bearer token (`bk_`-prefixed) that grants programmatic access to the API with scoped permissions and optional rate limiting |
| **Route Plugin** | An Elysia plugin that defines all HTTP endpoints for the API keys resource (`api-keys.route.ts`) |
| **Service** | An object literal that proxies calls to `auth.api.*` methods from better-auth's API key plugin (`api-keys.service.ts`) |
| **Serialize** | Converting better-auth's raw key objects (with Date fields as numbers/strings) to JSON-safe ISO string representations before API response |
| **better-auth API Key Plugin** | `@better-auth/api-key` — a better-auth plugin that manages API key lifecycle, rate limiting, and permission scoping |
| **Key Prefix** | The visible prefix of the full API key (e.g., `bk_abc...`); stored separately from the hashed key in the database |
| **Rate Limit** | A configurable limit on the number of requests an API key can make within a time window |
| **Key Expiry** | An optional `expiresAt` timestamp after which the API key is automatically considered invalid |
| **Eden Treaty** | Type-safe API client from `@elysiajs/eden` that infers types from the Elysia app |
| **Sheet** | A shadcn/ui slide-over panel from the right, used for create/edit forms |
| **Query Key Factory** | A hierarchical object that generates TanStack Query cache keys for the API keys resource |
| **Auth Plugin** | The Elysia plugin (`authPlugin`) that authenticates requests via session cookies or API key `Authorization` headers |

## 3. Requirements, Constraints & Guidelines

### 3.1 Backend Architecture

- **REQ-001**: The module resides in `packages/backend/src/modules/api-keys/` with `api-keys.route.ts` and `api-keys.service.ts`
- **REQ-002**: The route plugin is an Elysia instance with `{ prefix: '/api-keys', tags: ['API Keys'] }`
- **REQ-003**: The route plugin uses `authPlugin` (`.use(authPlugin)`) to authenticate requests
- **REQ-004**: Every endpoint must declare `requireAuth: true` and `requireOrg: true` in route meta
- **REQ-005**: Permissions are declared per-endpoint as `requirePermission: { apiKey: ['action'] }` where actions are `create`, `read`, `update`, `delete`
- **REQ-006**: Zod schemas define request validation (body, params) and response shapes
- **REQ-007**: Zod response schemas use `z.iso.datetime()` for all Date fields (ISO 8601 strings)
- **REQ-008**: A custom `serialize` function converts better-auth raw key objects (Date-as-number, nullable fields) to consistent JSON-safe shapes before returning to the client
- **REQ-009**: `serializeWithSecret` extends `serialize` to include the full API key string — used **only** on the create response (the secret is never returned after creation)
- **REQ-010**: All write operations call `void logAudit(...)` with `model: 'ApiKey'`, `operation`, `args`, `organizationId`, `userId`, `authType`
- **REQ-011**: OpenAPI `detail` objects with `summary` and `description` must be defined on every endpoint
- **REQ-012**: Not-found scenarios return `404` with `{ message: string }`
- **REQ-013**: The create endpoint returns `200` (not `201`) because better-auth's `createApiKey` does not set a 201 status — the response shape includes the secret key

### 3.2 Service Layer

- **REQ-014**: The service is exported as an object literal: `export const apiKeysService = { async method() {...} }`
- **REQ-015**: All service methods proxy to `auth.api.*` methods (e.g., `auth.api.createApiKey`, `auth.api.listApiKeys`, `auth.api.updateApiKey`, `auth.api.deleteApiKey`)
- **REQ-016**: Methods that need authentication pass `headers` from the incoming Elysia request to better-auth
- **REQ-017**: `createApiKey` injects `configId: 'default'` and appends `userId` to the `metadata` object
- **REQ-018**: `getApiKey` fetches the full list via `auth.api.listApiKeys` and filters client-side by `keyId` — better-auth does not provide a single-key lookup endpoint
- **REQ-019**: `listApiKeys` returns `result.apiKeys` from the better-auth response, filtered by `organizationId` via the `query` parameter
- **REQ-020**: `updateApiKey` passes `keyId` and `userId` in the body along with the fields to update
- **REQ-021**: `deleteApiKey` passes `headers` for authentication and `keyId` in the body to permanently revoke the key
- **REQ-022**: The service does **not** use Prisma directly — all database operations are delegated to better-auth

### 3.3 better-auth Integration

- **REQ-023**: The API key plugin is configured in `packages/backend/src/integrations/auth.ts` with `references: 'organization'` to scope keys to organizations
- **REQ-024**: `enableSessionForAPIKeys: false` — API key authentication does not create a session; it is stateless per-request
- **REQ-025**: `enableMetadata: true` — API keys support arbitrary metadata (JSON string in the Prisma model)
- **REQ-026**: `defaultPrefix: 'bk_'` — all generated API keys start with the `bk_` prefix
- **REQ-027**: Global rate limit defaults: `timeWindow: 1000 * 60 * 60` (1 hour), `maxRequests: 1000`; per-key overrides are supported
- **REQ-028**: API key authentication is handled transparently by `authPlugin` — when an `Authorization: Bearer bk_...` header is present, better-auth validates the key and provides `user`, `organization`, and `_authType` context to downstream handlers

### 3.4 Frontend Architecture

- **REQ-029**: The module resides in `packages/frontend/src/modules/api-keys/` with `hooks/`, `components/`, and `index.ts`
- **REQ-030**: TanStack Query hooks wrap Eden Treaty API calls in `hooks/use-api-keys.ts`
- **REQ-031**: Query key factories are defined inline in `hooks/use-api-keys.ts` as `apiKeyKeys`
- **REQ-032**: Cache invalidation must target the correct query key scope after mutations
- **REQ-033**: Forms use TanStack Form + Zod validation with `validators.onBlur` and `validators.onSubmit`
- **REQ-034**: Create/edit forms use shadcn `Sheet` component (slide-over, `sm:max-w-lg`)
- **REQ-035**: Delete confirmations use shadcn `Dialog`
- **REQ-036**: The `ApiKeyFormSheet` component renders a permissions matrix sourced from `useAvailablePermissions()` (from the roles module) — displaying resources as collapsible groups with individual action checkboxes
- **REQ-037**: Permission-gated UI via `useHasPermission('apiKey:action')`
- **REQ-038**: All UI text is in Indonesian (Bahasa Indonesia)

### 3.5 Database

- **REQ-039**: The `Apikey` model is managed by better-auth's migrations — its schema is defined in `schema.prisma` but should not be modified manually
- **REQ-040**: The primary key is a string ID generated by better-auth (not UUID v7)
- **REQ-041**: `referenceId` stores the `organizationId` (set via `references: 'organization'` in the plugin config)
- **REQ-042**: `permissions` and `metadata` are stored as JSON strings (not native JSON type) — better-auth serializes them
- **REQ-043**: The table is mapped as `@@map("apikey")` (lowercase, no underscore — better-auth convention)
- **REQ-044**: There is **no** soft delete (`deletedAt`) on API keys — deletion is permanent and irreversible
- **REQ-045**: The `key` field stores the hashed API key; the plaintext is only returned once at creation time

### 3.6 Constraints

- **CON-001**: Hyphenated resource name (`api-keys`) requires bracket notation in Eden client: `api['api-keys']`
- **CON-002**: better-auth's `listApiKeys` returns all keys for an organization — there is no built-in pagination, search, or single-key lookup; the service layer compensates by filtering client-side
- **CON-003**: `void logAudit(...)` is fire-and-forget (not awaited) to avoid blocking response
- **CON-004**: The API key secret is returned only in the `POST /api-keys` response via `serializeWithSecret` — all other endpoints use `serialize` which omits the `key` field
- **CON-005**: `getApiKey` performs a linear scan over all organization keys — this is acceptable for small key counts but would need optimization for organizations with hundreds of keys
- **CON-006**: better-auth does not support updating `expiresAt` after creation — only `name`, `enabled`, `permissions`, `rateLimitMax`, `rateLimitTimeWindow`, and `metadata` are updatable
- **CON-007**: API keys use hard delete (not soft delete) — there is no trash/restore workflow
- **CON-008**: When `permissions` is an empty object `{}` or `null` on a key, it grants **full access** (no restriction) — this is better-auth's default behavior

### 3.7 Guidelines

- **GUD-001**: Always display the API key secret to the user immediately after creation and warn them it cannot be retrieved again
- **GUD-002**: Prefer disabling a key (`enabled: false`) over deleting it when the intent is temporary revocation — deletion is irreversible
- **GUD-003**: When setting permissions, provide a clear UI indication that leaving all permissions unchecked grants full access
- **GUD-004**: The `useAvailablePermissions` hook from the roles module is the single source of truth for the permission matrix UI — do not hardcode permission lists

## 4. Interfaces & Data Contracts

### 4.1 HTTP Endpoints

| Method | Path | Description | Permission | Response |
|--------|------|-------------|------------|----------|
| POST | `/api-keys` | Create a new API key (returns secret) | `apiKey:create` | `200 ApiKeyWithSecret` |
| GET | `/api-keys` | List all API keys for the organization | `apiKey:read` | `200 ApiKey[]` |
| GET | `/api-keys/:id` | Get a specific API key by ID | `apiKey:read` | `200 ApiKey` or `404` |
| PATCH | `/api-keys/:id` | Update an API key (name, enabled, permissions, rate limit) | `apiKey:update` | `200 ApiKey` or `404` |
| DELETE | `/api-keys/:id` | Revoke and permanently delete an API key | `apiKey:delete` | `200 { message }` or `404` |

### 4.2 Request Bodies

#### Create API Key (`POST /api-keys`)

```typescript
const createApiKeyDto = z.object({
  name: z.string().min(1).max(64),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  expiresIn: z.number().positive().optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` (1–64 chars) | Yes | Human-readable label for the key |
| `permissions` | `Record<string, string[]>` | No | Scoped permissions (e.g., `{ product: ['read', 'create'] }`). Empty/null grants full access |
| `expiresIn` | `number` (ms) | No | Key expiration in milliseconds from creation (e.g., `86400000` for 1 day) |
| `rateLimitMax` | `number` | No | Max requests within the rate limit time window |
| `rateLimitTimeWindow` | `number` (ms) | No | Rate limit time window in milliseconds (e.g., `3600000` for 1 hour) |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata attached to the key |

#### Update API Key (`PATCH /api-keys/:id`)

```typescript
const updateApiKeyDto = z.object({
  name: z.string().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` (1–64 chars) | No | Updated label for the key |
| `enabled` | `boolean` | No | Enable or disable the key without deleting it |
| `permissions` | `Record<string, string[]>` | No | Updated scoped permissions |
| `rateLimitMax` | `number` | No | Updated rate limit ceiling |
| `rateLimitTimeWindow` | `number` (ms) | No | Updated rate limit window |
| `metadata` | `Record<string, unknown>` \| `null` | No | Updated metadata; pass `null` to clear |

### 4.3 Response Shapes

#### ApiKey (all endpoints except create)

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
```

#### ApiKeyWithSecret (create endpoint only)

```typescript
const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string(),
})
```

#### Error Response

```typescript
interface ErrorResponse {
  message: string;
}
```

### 4.4 Zod Schema Definitions

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

const apiKeyIdParam = z.object({
  id: z.string(),
})
```

### 4.5 Prisma Model

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

**Key fields explained**:
- `referenceId` — stores the `organizationId` (set by `references: 'organization'` in the plugin config)
- `key` — stores the hashed API key; the plaintext is never persisted
- `start` — the visible prefix of the key (e.g., `bk_abc...`)
- `permissions` — JSON string of scoped permissions (e.g., `'{"product":["read","create"]}'`)
- `metadata` — JSON string for arbitrary key metadata
- `remaining` — remaining requests in the current rate limit window
- `enabled` — `null` defaults to `true` (handled by serialization)

### 4.6 Frontend Query Key Factory

```typescript
export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: () => [...apiKeyKeys.lists()] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (id: string) => [...apiKeyKeys.details(), id] as const,
}
```

### 4.7 Frontend Hooks

| Hook | Purpose | Query Key | API Call |
|------|---------|-----------|----------|
| `useApiKeys()` | Fetch all API keys for the organization | `apiKeyKeys.list()` | `api['api-keys'].get()` |
| `useApiKey(id)` | Fetch a single API key by ID | `apiKeyKeys.detail(id)` | `api['api-keys']({ id }).get()` |
| `useCreateApiKey()` | Create a new API key | — (mutation) | `api['api-keys'].post(input)` |
| `useUpdateApiKey()` | Update an existing API key | — (mutation) | `api['api-keys']({ id }).patch(input)` |
| `useDeleteApiKey()` | Delete an API key | — (mutation) | `api['api-keys']({ id }).delete()` |

### 4.8 Frontend Cache Invalidation Patterns

```typescript
// After creating an API key:
queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })

// After updating an API key:
queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
queryClient.invalidateQueries({ queryKey: apiKeyKeys.detail(variables.id) })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })

// After deleting an API key:
queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
```

### 4.9 Frontend Component Structure

```
modules/api-keys/
  index.ts                             # Barrel export: hooks + components
  hooks/
    index.ts                           # Re-exports from use-api-keys
    use-api-keys.ts                    # Types, query keys, all query + mutation hooks
  components/
    index.ts                           # Re-exports ApiKeyFormSheet + DeleteDialog
    api-key-form-sheet.tsx             # Sheet form: name, expiry, permissions matrix, rate limit, enabled toggle
    delete-dialog.tsx                  # Confirmation dialog for API key deletion
```

### 4.10 Frontend Component Details

#### ApiKeyFormSheet

- **Purpose**: Create and edit API keys via a slide-over sheet
- **Props**: `open`, `onOpenChange`, `apiKey`, `onSubmit`, `isPending`, `mode` (`'create'` | `'edit'`)
- **Form fields**:
  - `name` — text input with Zod validation (1–64 chars, required)
  - `expiresIn` — select dropdown (create only): "Tidak ada batas", "1 hari", "7 hari", "30 hari", "90 hari", "1 tahun"
  - `permissions` — interactive permission matrix with resource groups, per-action checkboxes, "Pilih Semua" / "Hapus Semua" bulk actions, resource-level toggle with indeterminate state
  - `rateLimitMax` — number input for max requests
  - `rateLimitTimeWindow` — select dropdown: "1 menit", "1 jam", "1 hari"
  - `enabled` — checkbox toggle (edit only)
- **Dependencies**: Uses `useAvailablePermissions()` from the roles module to dynamically load the permission matrix
- **Permission conversion**: `recordToPermissions()` and `permissionsToRecord()` helpers convert between flat strings (`'product:read'`) and nested records (`{ product: ['read'] }`)
- **Sheet size**: `sm:max-w-lg` with `overflow-y-auto`
- **Labels**: All in Bahasa Indonesia (e.g., "Nama API Key", "Masa Berlaku", "Izin", "Batas Permintaan")

#### DeleteDialog

- **Purpose**: Confirmation dialog before deleting an API key
- **Props**: `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `isPending`, `confirmLabel` (default: "Ya, Hapus"), `cancelLabel` (default: "Batalkan")
- **Behavior**: Disables both buttons while deletion is in progress; shows "Menghapus..." on confirm button during pending state

### 4.11 Frontend Types

```typescript
interface ApiKey {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean | null
  permissions: Record<string, string[]> | null
  rateLimitMax: number | null
  rateLimitTimeWindow: number | null
  remaining: number | null
  lastRequest: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown> | null
}

interface ApiKeyWithSecret extends ApiKey {
  key: string
}

interface CreateApiKeyInput {
  name: string
  permissions?: Record<string, string[]>
  expiresIn?: number
  rateLimitMax?: number
  rateLimitTimeWindow?: number
  metadata?: Record<string, unknown>
}

interface UpdateApiKeyInput {
  name?: string
  enabled?: boolean
  permissions?: Record<string, string[]>
  rateLimitMax?: number
  rateLimitTimeWindow?: number
  metadata?: Record<string, unknown> | null
}
```

## 5. Acceptance Criteria

- **AC-001**: Given an authenticated user with `apiKey:create` permission, When they `POST /api-keys` with a valid body, Then a new API key is created with a `bk_` prefix, returned with its full secret, and an audit log entry is written
- **AC-002**: Given an authenticated user with `apiKey:read` permission, When they `GET /api-keys`, Then they receive an array of all API keys belonging to their organization (without secrets)
- **AC-003**: Given an authenticated user with `apiKey:read` permission, When they `GET /api-keys/:id` with a valid ID, Then they receive the API key details; if the ID does not exist in their organization, a `404` is returned
- **AC-004**: Given an authenticated user with `apiKey:update` permission, When they `PATCH /api-keys/:id` with `{ enabled: false }`, Then the key is disabled and subsequent API requests using that key are rejected
- **AC-005**: Given an authenticated user with `apiKey:delete` permission, When they `DELETE /api-keys/:id`, Then the API key is permanently revoked and deleted; subsequent API requests using that key are rejected
- **AC-006**: Given an API key with `expiresIn: 86400000` (1 day), When 24 hours have passed since creation, Then the key is expired and authentication fails
- **AC-007**: Given an API key with scoped permissions `{ product: ['read'] }`, When a request is made to `PATCH /products/:id`, Then a `403 Forbidden` is returned
- **AC-008**: Given an API key with empty or null permissions, When any request is made, Then it is treated as having full access (no permission restriction)
- **AC-009**: Given an unauthenticated request (no session cookie, no API key header), When any endpoint is called, Then a `401 Unauthorized` is returned
- **AC-010**: Given a user without the required permission, When the endpoint is called, Then a `403 Forbidden` is returned
- **AC-011**: Given the frontend permission matrix in `ApiKeyFormSheet`, When a user selects all actions for a resource, Then the resource checkbox shows a checkmark; when some are selected, it shows an indeterminate (minus) state
- **AC-012**: Given a newly created API key, When the user navigates away from the creation confirmation, Then the full secret key is no longer retrievable from any endpoint
- **AC-013**: Given an API key at its rate limit (`remaining: 0`), When a request is made, Then better-auth rejects the request with a rate limit error

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for service methods, integration tests for route handlers
- **Frameworks**: `bun:test` for backend, `vitest` + `@testing-library/react` for frontend
- **Backend test file**: `api-keys.test.ts` in the module directory, using Elysia's `app.handle(new Request(...))` pattern
- **Test Data Management**: Use better-auth's test utilities or direct Prisma inserts for API key fixtures; clean up after each test
- **CI/CD Integration**: Run `bun test` in CI pipeline
- **Coverage Requirements**: Cover happy paths (create, list, get, update, delete), error paths (404), permission checks, key expiry behavior, rate limiting edge cases
- **Frontend Testing**: Test hooks with `renderHook` + mock query client; test `ApiKeyFormSheet` permission toggle interactions; test `DeleteDialog` confirm/cancel flows

## 7. Rationale & Context

### Why Wrap better-auth Instead of Direct Prisma?

The API key module delegates all database operations to better-auth's `@better-auth/api-key` plugin because the plugin handles key hashing, rate limiting, permission enforcement, and expiration internally. Direct Prisma access would bypass these mechanisms and require reimplementing security-critical logic. The Elysia route layer adds organization scoping, permission enforcement via `requirePermission`, and audit logging on top of better-auth's foundation.

### Why No Pagination or Search?

better-auth's `listApiKeys` endpoint does not support pagination or search parameters — it returns all keys for a given organization. Most organizations will have a small number of API keys (typically under 20), making client-side rendering sufficient. If this changes, a future iteration could add pagination at the Elysia route level by slicing the better-auth response.

### Why No Soft Delete?

API keys are security credentials — soft-deleting a key would leave it active in the database while appearing deleted in the UI. Permanent deletion ensures that a compromised key is fully revoked. For temporary revocation, the `enabled: false` toggle should be used instead.

### Why `enableSessionForAPIKeys: false`?

API key authentication is stateless — each request is independently validated against the stored key. Creating a session would add unnecessary overhead and state management complexity for programmatic API access patterns.

### Why Stateful Permission Matrix UI?

The `ApiKeyFormSheet` renders a dynamic permission grid sourced from `useAvailablePermissions()` rather than a hardcoded list. This ensures the UI automatically reflects any changes to the permission system without requiring updates to the API keys module.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **PostgreSQL** - Stores API key data in the `apikey` table via better-auth's Prisma adapter

### Third-Party Services
- **SVC-001**: **better-auth** - Core authentication framework; provides organization plugin and `@better-auth/api-key` plugin for key lifecycle management, hashing, rate limiting, and permission scoping
- **SVC-002**: **@better-auth/api-key** - Specific better-auth plugin for API key CRUD, rate limiting, and scoped permissions

### Infrastructure Dependencies
- **INF-001**: **Bun runtime** (v1.3.10+) - Server runtime with native HTTP server
- **INF-002**: **Docker** - PostgreSQL container for local development

### Data Dependencies
- **DAT-001**: **Roles module** - Provides `useAvailablePermissions()` hook for the frontend permission matrix; the available permissions shape (`{ resources: string[], actions: Record<string, string[]>, permissions: string[] }`) drives the `ApiKeyFormSheet` UI
- **DAT-002**: **Audit logs module** - `auditLogKeys.all` is invalidated on every API key mutation to keep the audit log table up-to-date

### Technology Platform Dependencies
- **PLT-001**: **Elysia.js** - HTTP framework with Zod integration and Eden Treaty client generation
- **PLT-002**: **Prisma ORM** - Database access layer (used indirectly through better-auth's adapter)
- **PLT-003**: **TanStack Query** - Server state management (caching, invalidation)
- **PLT-004**: **TanStack Form** - Form state management with Zod validation
- **PLT-005**: **shadcn/ui + Radix** - UI component primitives (Sheet, Dialog, Checkbox, Select, Input)

### Compliance Dependencies
- **COM-001**: **Audit logging** - All write operations (create, update, delete) must be logged with user identity and operation details
- **COM-002**: **Permission scoping** - API keys enforce scoped permissions at the route level via `requirePermission`; keys without permissions grant full access

## 9. Examples & Edge Cases

### 9.1 Backend Route Plugin

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'
import { authPlugin } from '#plugins/auth.plugin'
import { apiKeysService } from './api-keys.service'
import { errorResponse } from '#common/error.response'
import { logAudit } from '#libraries/audit-logger'

const createApiKeyDto = z.object({
  name: z.string().min(1).max(64),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
  expiresIn: z.number().positive().optional(),
  rateLimitMax: z.number().positive().optional(),
  rateLimitTimeWindow: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const apiKeysRoute = new Elysia({
  prefix: '/api-keys',
  tags: ['API Keys'],
})
  .use(authPlugin)
  .post('/', async ({ _authType, user, organization, body }) => {
    const key = await apiKeysService.createApiKey(user.id, organization.id, body)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'ApiKey',
      operation: 'create',
      args: { data: body },
    })
    return serializeWithSecret(key)
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { apiKey: ['create'] },
    body: createApiKeyDto,
    response: { 200: apiKeyWithSecretSchema },
    detail: {
      summary: 'Create an API key',
      description: 'Creates a new API key for the authenticated organization with scoped permissions.',
    },
  })
  .get('/', async ({ organization, request }) => {
    const keys = await apiKeysService.listApiKeys(request.headers, organization.id)
    return keys.map(serialize)
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { apiKey: ['read'] },
    response: { 200: z.array(apiKeySchema) },
    detail: {
      summary: 'List API keys',
      description: 'Retrieves all API keys belonging to the authenticated organization.',
    },
  })
  .delete('/:id', async ({ _authType, user, organization, params, status, request }) => {
    const existing = await apiKeysService.getApiKey(request.headers, organization.id, params.id)
    if (!existing) return status(404, { message: 'API key not found' })
    await apiKeysService.deleteApiKey(request.headers, params.id)
    void logAudit({
      organizationId: organization.id,
      userId: user.id,
      authType: _authType,
      model: 'ApiKey',
      operation: 'delete',
      args: { id: params.id },
    })
    return status(200, { message: 'API key deleted' })
  }, {
    requireAuth: true,
    requireOrg: true,
    requirePermission: { apiKey: ['delete'] },
    params: apiKeyIdParam,
    response: { 200: errorResponse, 404: errorResponse },
    detail: {
      summary: 'Delete an API key',
      description: 'Revokes and deletes an API key by its ID.',
    },
  })
```

### 9.2 Backend Service

```typescript
import { auth } from '#integrations/auth'

export const apiKeysService = {
  async createApiKey(userId: string, organizationId: string, data: {
    name: string
    permissions?: Record<string, string[]>
    expiresIn?: number
    rateLimitMax?: number
    rateLimitTimeWindow?: number
    metadata?: Record<string, unknown>
  }) {
    return auth.api.createApiKey({
      body: {
        configId: 'default',
        userId,
        organizationId,
        name: data.name,
        permissions: data.permissions,
        expiresIn: data.expiresIn,
        rateLimitMax: data.rateLimitMax,
        rateLimitTimeWindow: data.rateLimitTimeWindow,
        metadata: { ...data.metadata, userId },
      },
    })
  },

  async listApiKeys(headers: Headers, organizationId: string) {
    const result = await auth.api.listApiKeys({ headers, query: { organizationId } })
    return result.apiKeys
  },

  async getApiKey(headers: Headers, organizationId: string, keyId: string) {
    const result = await auth.api.listApiKeys({ headers, query: { organizationId } })
    return result.apiKeys.find((k) => k.id === keyId) ?? null
  },

  async updateApiKey(userId: string, keyId: string, data: {
    name?: string
    enabled?: boolean
    permissions?: Record<string, string[]>
    rateLimitMax?: number
    rateLimitTimeWindow?: number
    metadata?: Record<string, unknown> | null
  }) {
    return auth.api.updateApiKey({ body: { keyId, userId, ...data } })
  },

  async deleteApiKey(headers: Headers, keyId: string) {
    return auth.api.deleteApiKey({ headers, body: { keyId } })
  },
}
```

### 9.3 Frontend Hook

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#lib/api'
import { auditLogKeys } from '#modules/audit-logs/hooks/use-audit-logs'

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: () => [...apiKeyKeys.lists()] as const,
  details: () => [...apiKeyKeys.all, 'detail'] as const,
  detail: (id: string) => [...apiKeyKeys.details(), id] as const,
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const { data, error } = await api['api-keys'].post(input)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api['api-keys']({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
      queryClient.invalidateQueries({ queryKey: auditLogKeys.all })
    },
  })
}
```

### 9.4 Edge Cases

- **Key expiry at boundary**: If a key expires between the time it is validated and the time the request completes, the request still succeeds — expiration is checked at authentication time only
- **Empty permissions grant full access**: When `permissions` is `null`, `{}`, or an empty array, better-auth treats the key as having no permission restrictions. The UI must warn users about this behavior
- **Linear scan for single key lookup**: `getApiKey` fetches all organization keys and filters by ID in JavaScript. For organizations with very large numbers of keys, this becomes a performance concern — a future optimization could cache keys in-memory or use direct Prisma queries
- **Rate limit `remaining` is null until first request**: Newly created keys have `remaining: null` until the first request is made against them. The UI should handle this null state gracefully
- **`enabled` field is nullable**: The `Apikey.enabled` column is `Boolean?` (nullable). The serializer defaults `null` to `true`: `(key.enabled as boolean | null) ?? true`
- **`expiresIn` cannot be changed after creation**: better-auth does not support updating `expiresAt` after key creation. If a user needs to extend a key's lifetime, they must create a new key and delete the old one
- **Metadata injection**: The service layer always injects `userId` into the `metadata` object on creation (`metadata: { ...data.metadata, userId }`). If the caller passes metadata with a `userId` key, it will be overwritten
- **`deleteApiKey` requires headers but not userId**: Unlike `updateApiKey`, the delete method authenticates via `headers` (to verify the caller has permission) rather than requiring `userId` in the body — better-auth handles the authorization internally
- **No pagination on list endpoint**: The `GET /api-keys` endpoint returns all keys without pagination. Consumers must handle the full array client-side

## 10. Validation Criteria

A module conforming to this specification must satisfy:

1. **File structure**: `modules/api-keys/` with `.route.ts`, `.service.ts`; frontend has `hooks/`, `components/`, `index.ts`
2. **Auth & permissions**: All endpoints use `authPlugin`, `requireAuth`, `requireOrg`, and `requirePermission: { apiKey: [...] }`
3. **Serialization**: All Date fields return ISO 8601 strings; nullable fields default to sensible values in the serializer
4. **No soft delete**: DELETE is permanent; no `deletedAt` field or trash/restore workflow
5. **Secret returned once**: Only `POST /api-keys` returns the full key via `serializeWithSecret`; all other endpoints use `serialize`
6. **Audit logging**: All write operations (create, update, delete) call `void logAudit(...)` with `model: 'ApiKey'`
7. **OpenAPI docs**: Every endpoint has `detail.summary` and `detail.description`
8. **Frontend query keys**: Hierarchical factory with `all`, `lists()`, `list()`, `details()`, `detail(id)`
9. **Cache invalidation**: Mutations invalidate `apiKeyKeys` scopes and `auditLogKeys.all`
10. **Indonesian UI**: All user-facing text in `ApiKeyFormSheet` and `DeleteDialog` is in Bahasa Indonesia
11. **Permission guards**: Create/edit/delete UI elements gated by `useHasPermission('apiKey:action')`
12. **better-auth delegation**: Service methods proxy to `auth.api.*` — no direct Prisma queries for API key CRUD

## 11. Changelog (from previous version)

N/A — This is the initial specification.

## 12. Related Specifications / Further Reading

- Backend auth integration: `packages/backend/src/integrations/auth.ts`
- Auth plugin: `packages/backend/src/plugins/auth.plugin.ts`
- Audit logger: `packages/backend/src/libraries/audit-logger.ts`
- Permissions library: `packages/backend/src/libraries/permissions.ts`
- Roles module (permission source): `packages/frontend/src/modules/roles/hooks/use-roles.ts`
- Frontend API client: `packages/frontend/src/lib/api.ts`
- better-auth API key plugin: `@better-auth/api-key` (npm package documentation)
- better-auth organization plugin: `better-auth/plugins` (organization)
