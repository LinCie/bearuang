---
title: Offline Auth Persistence & Dual-Fetch Elimination
version: v2
date_created: 2026-04-04
last_updated: 2026-04-04
owner: Frontend Team
feature: offline-first
tags: [offline, auth, tanstack-query, persist, session, permissions, pwa, better-auth]
previous_version: ./spec-v1.md
---

# Introduction

This specification extends the offline-first architecture (spec-v1) to solve a critical gap: **the PWA redirects to the sign-in page when the user goes offline**. This happens because the session and permissions queries fail with network errors, and the route `beforeLoad` guards redirect on null session data. The fix combines TanStack Query persistence (to restore cached auth data on reload) with elimination of better-auth's dual-fetch React hooks (to ensure all auth data flows through TanStack Query's cache layer). Additionally, route guards are updated to gracefully handle offline refetch failures when cached data exists.

## 1. Purpose & Scope

### 1.1 Purpose

Enable the BearUang PWA to remain functional offline for authenticated users by:

1. Persisting auth-related TanStack Query cache (session + permissions) to `localStorage` so it survives page reloads
2. Eliminating better-auth's independent React hooks (`useSession`, `useActiveOrganization`, `useActiveMember`, `useListOrganizations`) that fetch outside TanStack Query's cache, replacing them with TanStack Query `queryOptions`
3. Making route guards offline-aware so they use cached auth data when the network is unavailable
4. Fixing unhandled throws in auth action handlers when offline

### 1.2 Scope

- **In scope**: TanStack Query cache persistence (session + permissions only), `onlineManager` initialization fix, replacement of better-auth React hooks with TanStack Query wrappers, offline-safe route guards, try/catch for unhandled auth throws, persisted cache cleanup on sign-out
- **Out of scope**: Offline sign-in/sign-up flows, offline session token refresh, offline organization creation/invitation, persisting all 45+ module queries (only auth queries are persisted), IndexedDB auth storage (session stays in TanStack Query cache backed by localStorage, per SEC-001/SEC-002)
- **Audience**: Frontend developers working on auth, routing, and offline-first features

### 1.3 Assumptions

- The user has previously authenticated and has an active session (cookie).
- The user has selected an organization (org context is required for permissions).
- `localStorage` is available in the user's browser (all modern browsers).
- Offline auth flows (sign-in, sign-up, session refresh) remain out of scope per spec-v1 section 1.2.
- If the session cookie expires while offline, the user will see stale data until they reconnect and the session is revalidated. This is acceptable per the spec-v1 assumption that "the user has previously authenticated and has an active session."

## 2. Definitions

| Term | Definition |
|------|-----------|
| **TanStack Query Persist Client** | A TanStack Query plugin (`@tanstack/react-query-persist-client`) that serializes the query cache to a storage backend and restores it on app startup |
| **Async Storage Persister** | A persister implementation (`@tanstack/query-async-storage-persister`) that uses `localStorage.getItem`/`setItem` as the storage backend |
| **`shouldDehydrateQuery`** | A callback that determines which queries are persisted; used for selective persistence (only session + permissions) |
| **`onlineManager`** | A TanStack Query singleton that tracks online/offline status; used by queries to decide whether to refetch |
| **`networkMode: 'offlineFirst'`** | A query option that causes TanStack Query to use cached data immediately while attempting a background refetch, even when offline |
| **Dual-fetch** | The current anti-pattern where better-auth's React hooks (`useSession`, etc.) make independent HTTP requests outside of TanStack Query's cache, resulting in duplicate network calls |
| **`PersistQueryClientProvider`** | A React provider that replaces `QueryClientProvider`, restoring the persisted cache before the first render and persisting on cache changes |
| **Dehydration** | The process of serializing a query from the TanStack Query cache to the storage backend |
| **Rehydration** | The process of restoring persisted query data from the storage backend into the TanStack Query cache |

## 3. Requirements, Constraints & Guidelines

### 3.1 Functional Requirements

- **REQ-001**: The TanStack Query cache for session and permissions queries must be persisted to `localStorage` and restored on app startup, before React renders.
- **REQ-002**: `onlineManager.setOnline(navigator.onLine)` must be called before React renders to prevent false-positive refetches on offline startup (TanStack Query v5 defaults to `online: true` regardless of actual network state).
- **REQ-003**: Only queries matching `queryKey: ['session']` or `queryKey: ['permissions']` must be persisted. All other queries (45+ module queries) must NOT be persisted to `localStorage`.
- **REQ-004**: The session token must be stripped from persisted session data before serialization to `localStorage` (SEC-001 compliance).
- **REQ-005**: The `networkMode: 'offlineFirst'` option must be set on `sessionQueryOptions` and `permissionsQueryOptions` so that stale cached data is served immediately even when offline, with background refetch when online.
- **REQ-006**: `useSession()` (from better-auth/react) must be replaced with `useQuery(sessionQueryOptions)` in all components: `DashboardLayout`, `settings/index.tsx`, `_dashboard/index.tsx`.
- **REQ-007**: `useActiveOrganization()` (from better-auth/react) must be replaced by deriving the active organization from the session query data (the session response already contains `activeOrganizationId`; there is no separate client endpoint for this).
- **REQ-008**: `useActiveMember()` (from better-auth/react) must be replaced with `useQuery(activeMemberQueryOptions)` in `settings/index.tsx`. The `activeMemberQueryOptions` wraps `authClient.organization.getActiveMember()`.
- **REQ-009**: `useListOrganizations()` (from better-auth/react) must be replaced with `useQuery(listOrganizationsQueryOptions)` in `organizations.tsx`. The `listOrganizationsQueryOptions` wraps `authClient.organization.list()`.
- **REQ-010**: The `_dashboard/route.tsx` `beforeLoad` guard must be updated to handle offline gracefully: if `ensureQueryData(sessionQueryOptions)` throws a network error but the query cache contains session data, the guard must proceed instead of redirecting to `/signin`.
- **REQ-011**: The `organizations.tsx` `beforeLoad` guard must be updated with the same offline-safe pattern as REQ-010.
- **REQ-012**: On sign-out (`dashboard-layout.tsx`), persisted auth queries must be cleared from both TanStack Query cache and `localStorage` via `queryClient.removeQueries({ queryKey: ['session'] })` and `queryClient.removeQueries({ queryKey: ['permissions'] })`.

### 3.2 Non-Functional Requirements

- **NFR-001**: Persisted cache must be restored synchronously (or before first meaningful paint) so there is no flash of unauthenticated content on offline reload.
- **NFR-002**: The `localStorage` key for persisted queries must be namespaced (e.g., `bearuang-query-cache`) to avoid conflicts with other apps on the same origin.
- **NFR-003**: The `gcTime` (garbage collection time) for the `QueryClient` must be set to `Infinity` (or a large value like 24 hours) to prevent persisted queries from being garbage-collected before the next persistence cycle.
- **NFR-004**: All persisted queries must use `networkMode: 'offlineFirst'` to prevent TanStack Query from suspending when offline with stale cached data.

### 3.3 Security Requirements

- **SEC-001** (from spec-v1): IndexedDB must not store API keys, session tokens, or full user credentials. This spec uses `localStorage` (not IndexedDB) and strips the session token before persistence.
- **SEC-002** (from spec-v1): Session tokens must remain in memory/cookies only. The session token is stripped from the persisted payload; only user identity data (id, name, email, image) and organization context (activeOrganizationId) are persisted.
- **SEC-003** (from spec-v1): Clear offline data on org switch and logout. This spec clears persisted auth queries on logout. Org switch already clears IndexedDB data via `clearOrgData`.

### 3.4 Constraints

- **CON-001**: `PersistQueryClientProvider` replaces `QueryClientProvider` in `main.tsx`. The provider must be initialized before any route renders.
- **CON-002**: The `onlineManager` fix (REQ-002) must execute before `PersistQueryClientProvider` mounts, otherwise the provider triggers refetches immediately after restoring the cache.
- **CON-003**: TanStack Query's `onlineManager` defaults to `online: true` on startup (confirmed by TkDodo in TanStack Query GitHub Discussion #7027 and Issue #10142). Without the fix in REQ-002, offline startup causes: restore cache -> refetch (thinks online) -> network error -> query enters error state -> error queries not persisted by `shouldDehydrateQuery` default -> on next reload, cache is gone.
- **CON-004**: `useActiveOrganization()` does NOT have a separate client endpoint. It internally calls `useSession()` and extracts `activeOrganizationId` from the session response. Therefore, no separate `activeOrganizationQueryOptions` is needed.
- **CON-005**: better-auth's `useSession()` and other React hooks manage their own fetch lifecycle independently of TanStack Query. Keeping both active causes duplicate network requests and inconsistent cache states.
- **CON-006**: The `shouldDehydrateQuery` callback must return `false` for error-state queries to prevent persisting error data, which would cause the persister to discard the entire cache on restore.

### 3.5 Guidelines

- **GUD-001**: When adding new auth-related queryOptions that need persistence, add their `queryKey` prefix to the `shouldDehydrateQuery` filter in `lib/persister.ts`.
- **GUD-002**: Do NOT persist business data queries (products, orders, customers, etc.) to `localStorage`. These are already synced to IndexedDB via the sync pipeline (spec-v1).
- **GUD-003**: After any auth state change (sign-in, sign-out, org switch), invalidate both `['session']` and `['permissions']` query keys. The persisted cache will be updated automatically by the persister.

## 4. Interfaces & Data Contracts

### 4.1 Persister Configuration

```typescript
// packages/frontend/src/lib/persister.ts

import {
  PersistedClient,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client'
import { QueryClient } from '@tanstack/react-query'

const PERSIST_KEY = 'bearuang-query-cache'

type SessionData = {
  session: {
    id: string
    userId: string
    activeOrganizationId: string | null
    expiresAt: string
    token: string // must be stripped before persisting
    // ...other session fields
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
    emailVerified: boolean
    createdAt: string
    updatedAt: string
  }
}

function stripSessionToken(data: unknown): unknown {
  if (
    data &&
    typeof data === 'object' &&
    'session' in data &&
    data.session &&
    typeof data.session === 'object' &&
    'token' in data.session
  ) {
    const { token: _token, ...sessionWithoutToken } = data.session
    return { ...data, session: sessionWithoutToken }
  }
  return data
}

function shouldDehydrateQuery(query: {
  queryKey: unknown[]
  state: { data: unknown; status: string }
}): boolean {
  const key = query.queryKey
  return (
    key[0] === 'session' || key[0] === 'permissions'
  ) && query.state.status === 'success'
}

function serialize(data: PersistedClient): string {
  const filtered = {
    ...data,
    clientState: {
      ...data.clientState,
      queries: data.clientState.queries.map((query) => {
        const stripped =
          query.state.data && query.queryKey[0] === 'session'
            ? stripSessionToken(query.state.data)
            : query.state.data
        return { ...query, state: { ...query.state, data: stripped } }
      }),
    },
  }
  return JSON.stringify(filtered)
}
```

### 4.2 Updated Session Query Options

```typescript
// packages/frontend/src/lib/session.ts

import { queryOptions } from '@tanstack/react-query'
import { authClient } from './auth-client'

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const { data } = await authClient.getSession()
    return data
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: false,
  networkMode: 'offlineFirst', // NEW: serve stale data immediately when offline
})
```

### 4.3 Updated Permissions Query Options

```typescript
// packages/frontend/src/lib/use-permissions.ts

export const permissionsQueryOptions = () =>
  queryOptions({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 1000 * 60 * 5,
    networkMode: 'offlineFirst', // NEW: serve stale data immediately when offline
  })
```

### 4.4 New Active Member Query Options

```typescript
// packages/frontend/src/lib/auth-query-options.ts (new file)

import { queryOptions } from '@tanstack/react-query'
import { authClient } from './auth-client'

export const activeMemberQueryOptions = queryOptions({
  queryKey: ['active-member'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.getActiveMember()
    if (error) throw new Error(error.message)
    return data
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
})
```

### 4.5 New List Organizations Query Options

```typescript
// packages/frontend/src/lib/auth-query-options.ts (continued)

export const listOrganizationsQueryOptions = queryOptions({
  queryKey: ['organizations', 'list'],
  queryFn: async () => {
    const { data, error } = await authClient.organization.list()
    if (error) throw new Error(error.message)
    return data
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
})
```

### 4.6 Updated main.tsx Provider

```typescript
// packages/frontend/src/main.tsx

import { onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { createPersister, PERSIST_KEY } from './lib/persister'

// CRITICAL: Must run before React renders to prevent false-positive refetches
onlineManager.setOnline(navigator.onLine)

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_KEY,
})

// ...
root.render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister }}
  >
    <RouterProvider router={router} />
  </PersistQueryClientProvider>,
)
```

### 4.7 Offline-Safe Route Guard Pattern

```typescript
// _dashboard/route.tsx beforeLoad (updated)

const session = await queryClient
  .ensureQueryData(sessionQueryOptions)
  .catch(() => queryClient.getQueryData(sessionQueryOptions.queryKey))

if (!session) {
  throw redirect({ to: '/signin', search: { redirect: to } })
}
```

```typescript
// organizations.tsx beforeLoad (updated)

const session = await queryClient
  .ensureQueryData(sessionQueryOptions)
  .catch(() => queryClient.getQueryData(sessionQueryOptions.queryKey))

if (!session) {
  throw redirect({ to: '/signin', search: { redirect: to } })
}
```

### 4.8 Sign-Out Cache Cleanup

```typescript
// dashboard-layout.tsx handleSignOut (updated)

async function handleSignOut() {
  if (isSigningOut) return
  setIsSigningOut(true)
  try {
    await signOut()
    queryClient.removeQueries({ queryKey: ['session'] })
    queryClient.removeQueries({ queryKey: ['permissions'] })
    queryClient.removeQueries({ queryKey: ['active-member'] })
    queryClient.removeQueries({ queryKey: ['organizations'] })
    router.navigate({ to: '/signin' })
  } catch {
    setIsSigningOut(false)
  }
}
```

### 4.9 Deriving Active Organization from Session

```typescript
// Before (better-auth hook):
const { data: orgData, isPending: orgPending } = useActiveOrganization()

// After (derived from session query):
const { data: sessionData } = useQuery(sessionQueryOptions)
const activeOrganization = sessionData?.session?.activeOrganizationId
  ? { id: sessionData.session.activeOrganizationId }
  : null
```

### 4.10 P1 Fix: Try/Catch for Auth Action Handlers

All auth action handlers that call `authClient.*` methods must be wrapped in try/catch with user-facing error feedback (toast notifications).

| File | Lines | Action | Fix |
|------|-------|--------|-----|
| `organizations.tsx` | 115-128 | Create organization + fetchQuery | Wrap in try/catch, show toast on error |
| `organizations.tsx` | 151-162 | Accept invitation + fetchQuery | Wrap in try/catch, show toast on error |
| `organizations.tsx` | 180-191 | Set active org + fetchQuery | Wrap in try/catch, show toast on error |
| `settings/index.tsx` | 494 | Update organization | Wrap in try/catch, show toast on error |
| `settings/index.tsx` | 747 | Delete organization | Wrap in try/catch, show toast on error |
| `products/index.tsx` | 147-155 | Image add/remove via direct api.* calls | Wrap in try/catch, show toast on error |

## 5. Acceptance Criteria

- **AC-001**: Given a user with an active session, When the PWA reloads while offline, Then the dashboard renders using persisted session and permissions data (no redirect to `/signin`).
- **AC-002**: Given persisted session data exists in `localStorage`, When the app loads offline, Then `onlineManager` is set to `false` before `PersistQueryClientProvider` mounts, preventing false refetch attempts.
- **AC-003**: Given the session query has cached data, When the user navigates to any dashboard route while offline, Then the `_dashboard/route.tsx` `beforeLoad` proceeds without redirecting.
- **AC-004**: Given no persisted session data and no network, When the app loads, Then the user is redirected to `/signin` (expected behavior — no session available).
- **AC-005**: Given persisted session data in `localStorage`, When the data is inspected, Then the session `token` field must NOT be present (SEC-001).
- **AC-006**: Given a user signs out, When the sign-out completes, Then `['session']`, `['permissions']`, `['active-member']`, and `['organizations']` query keys are removed from both TanStack Query cache and `localStorage`.
- **AC-007**: Given a user signs in, When the sign-in completes, Then the session and permissions queries are refetched and the persisted cache is updated with fresh data.
- **AC-008**: Given `useSession()` has been replaced with `useQuery(sessionQueryOptions)`, When the session is fetched, Then only ONE network request is made (no duplicate from better-auth hook).
- **AC-009**: Given `useActiveOrganization()` has been replaced, When the active organization is accessed, Then no additional network request is made (derived from session data).
- **AC-010**: Given `useListOrganizations()` has been replaced with `useQuery(listOrganizationsQueryOptions)`, When the organizations page loads, Then organizations are fetched via TanStack Query (cached, retryable, persistable).
- **AC-011**: Given an auth action (create org, accept invitation, set active org, update org, delete org) fails while offline, When the action is attempted, Then a user-facing error toast is shown instead of an unhandled throw.
- **AC-012**: Given queries other than session and permissions (e.g., products, orders), When the cache is persisted, Then these queries must NOT appear in the `localStorage` payload.

## 6. Test Automation Strategy

### 6.1 Test Levels

| Level | Scope | Priority |
|-------|-------|----------|
| Unit | `persister.ts` — `shouldDehydrateQuery` filter, `stripSessionToken` function, serialization/deserialization | High |
| Unit | `session.ts` — verify `networkMode: 'offlineFirst'` is set on `sessionQueryOptions` | Medium |
| Unit | `use-permissions.ts` — verify `networkMode: 'offlineFirst'` is set on `permissionsQueryOptions` | Medium |
| Integration | Route guards — verify offline-safe pattern (catch returns cached data, only redirects when truly null) | High |
| Integration | Sign-out flow — verify cache cleanup removes persisted data from `localStorage` | High |
| E2E | Offline reload — sign in, reload offline, verify dashboard renders without redirect | Medium |

### 6.2 Frameworks

- **Frontend unit/integration**: Vitest + `@testing-library/react`
- **E2E**: Playwright (Service Worker support via `context.serviceWorkers()`)

### 6.3 Coverage Requirements

- 100% coverage for `persister.ts` (strip token logic is security-critical)
- Route guard tests must cover: online+session, online+no session, offline+cached session, offline+no cached session

### 6.4 CI/CD Integration

- Persister unit tests run as part of existing `bun run test` / `bun run check` workflow
- E2E offline tests should be gated behind a separate job (requires browser environment)

## 7. Rationale & Context

### 7.1 Why TanStack Query Persistence (not Dexie for auth data)?

Auth data (session + permissions) is small (< 5KB) and needs to be restored synchronously before React renders. `localStorage` is synchronous and available immediately. Dexie (IndexedDB) is asynchronous and introduces a render delay. Additionally, SEC-001/SEC-002 already prohibit storing sensitive auth data in IndexedDB. `localStorage` with token stripping provides a simpler, faster, and spec-compliant solution.

### 7.2 Why `onlineManager.setOnline(navigator.onLine)` is Critical

TanStack Query v5 initializes `onlineManager` as `online: true` by default. It does NOT check `navigator.onLine` on startup — it only listens for subsequent `online`/`offline` events. When `PersistQueryClientProvider` restores cached queries, it sets them to `fetchingState: 'idle'` and then triggers refetches because it thinks the app is online. If the app is actually offline:

1. Refetches are attempted
2. They fail with network errors
3. Queries transition to `error` state
4. The default `shouldDehydrateQuery` returns `false` for error-state queries
5. Error queries are not persisted
6. On the next offline reload, the cache is gone

The fix (`onlineManager.setOnline(navigator.onLine)`) was confirmed by TkDodo (TanStack Query maintainer) in GitHub Discussion #7027 and Issue #10142.

### 7.3 Why Replace better-auth React Hooks?

better-auth's React hooks (`useSession`, `useActiveOrganization`, `useActiveMember`, `useListOrganizations`) manage their own internal fetch lifecycle independently of TanStack Query. This causes:

1. **Duplicate network requests**: `useSession()` fetches `/auth/get-session` independently, while `ensureQueryData(sessionQueryOptions)` in route guards also fetches the same endpoint
2. **Inconsistent state**: The hooks' internal state can diverge from TanStack Query's cache
3. **No persistence**: Hook data is not persisted to `localStorage` by TanStack Query's persister
4. **No offline support**: Hooks don't support `networkMode: 'offlineFirst'`

Replacing them with TanStack Query `queryOptions` provides a single source of truth for auth data, enables persistence, and supports offline-first behavior.

### 7.4 Why `useActiveOrganization()` Does NOT Need a Separate Query Option

The better-auth `useActiveOrganization()` hook internally calls `useSession()` and extracts `activeOrganizationId` from the session response. There is no separate `authClient.organization.getActiveOrganization()` client method. Therefore, the active organization is already available in the session query data, and deriving it from the session eliminates an unnecessary network request.

### 7.5 Why Not Persist All Queries?

Persisting all 45+ module queries to `localStorage` would:
- Significantly increase `localStorage` usage (potentially exceeding the 5-10MB limit)
- Conflict with the existing IndexedDB sync pipeline (spec-v1) which already stores reference data offline
- Increase persistence/dehydration time on every cache change

Only auth queries (session + permissions) need persistence because they are not covered by the IndexedDB sync pipeline, and they are required before any dashboard page can render.

## 8. Dependencies & External Integrations

### New Packages

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query-persist-client` | Provides `PersistQueryClientProvider` and persistence utilities for TanStack Query |
| `@tanstack/query-async-storage-persister` | Provides `createAsyncStoragePersister` for `localStorage`-backed persistence |

### Existing Dependencies (unchanged)

- **EXT-001**: better-auth session endpoint (`GET /auth/get-session`) — session query data source
- **EXT-002**: better-auth organization endpoints (`GET /auth/organization/list`, `GET /auth/organization/get-active-member`) — active member and organization list data sources
- **EXT-003**: BearUang permissions endpoint (`GET /permissions`) — permissions query data source

### Technology Platform Dependencies

- **PLT-001**: **TanStack Query v5** — Must be compatible with `@tanstack/react-query-persist-client` (requires v5.x)
- **PLT-002**: **React 19** — Required for `PersistQueryClientProvider`
- **PLT-003**: **Bun** — Package manager for installing new dependencies

## 9. Examples & Edge Cases

### 9.1 Offline Reload Flow (Happy Path)

```
1. User is authenticated, session and permissions cached in TanStack Query
2. Persister serializes cache to localStorage (session token stripped)
3. User closes browser tab
4. User opens PWA while offline
5. main.tsx: onlineManager.setOnline(false) // navigator.onLine is false
6. PersistQueryClientProvider restores cache from localStorage
7. Queries restored with status 'success' and staleTime 5min
8. User navigates to /products
9. _dashboard/route.tsx beforeLoad:
   - ensureQueryData(sessionQueryOptions)
   - With networkMode: 'offlineFirst', returns cached data immediately
   - Cached session has activeOrganizationId → no redirect
   - ensureQueryData(permissionsQueryOptions())
   - Returns cached permissions → permission check passes
   - Route renders with cached data
10. Dashboard shows product list from IndexedDB (spec-v1 sync pipeline)
```

### 9.2 Offline Reload with Expired Stale Time

```
1. User was last online 10 minutes ago (staleTime: 5min exceeded)
2. User opens PWA while offline
3. onlineManager.setOnline(false)
4. PersistQueryClientProvider restores cache from localStorage
5. Queries restored, but marked as stale
6. TanStack Query attempts background refetch (networkMode: 'offlineFirst')
7. onlineManager is offline → refetch is skipped
8. Stale cached data is served → dashboard renders
9. When network reconnects:
   - 'online' event fires
   - onlineManager.setOnline(true)
   - TanStack Query refetches session and permissions
   - Fresh data replaces stale persisted data
```

### 9.3 Sign-Out While Offline

```
1. User clicks sign-out while offline
2. signOut() calls POST /auth/sign-out → fails (network error)
3. Catch block: shows error toast, sets isSigningOut to false
4. Alternative: optimistically clear local auth state even if server call fails
   - Clear TanStack Query caches (session, permissions, active-member, organizations)
   - Navigate to /signin
   - Server-side session remains valid but cookie is not cleared
   - On reconnect, next session fetch will return the old session
   - NOTE: This is a deliberate trade-off. Sign-out MUST succeed server-side to invalidate the session. If offline, sign-out should fail gracefully and retry when online.
```

### 9.4 localStorage Full or Unavailable

```
1. localStorage quota exceeded (rare, ~5KB auth data)
2. Persister's setItem call throws
3. PersistQueryClientProvider catches the error
4. Cache still works in memory (just not persisted)
5. App functions normally but won't survive offline reload
6. No user-visible impact during the current session
```

### 9.5 Multiple Tabs

```
1. Tab A signs in → session cached → persisted to localStorage
2. Tab B reloads → reads persisted cache from localStorage
3. Tab A signs out → clears cache and localStorage
4. Tab B is still open with stale session in memory
5. Tab B's next navigation triggers a route guard
6. ensureQueryData tries to refetch → 401 (session invalidated on server)
7. Query returns null → redirect to /signin
```

### 9.6 Corrupted Persisted Data

```
1. localStorage data is corrupted (manual editing, storage bug)
2. Persister's getItem returns invalid JSON
3. PersistQueryClientProvider catches the parse error
4. Cache starts empty → app behaves as if first visit
5. Route guard fetches session → if online, succeeds; if offline, redirects to /signin
```

## 10. Validation Criteria

| ID | Criterion | Validation Method |
|----|-----------|-------------------|
| **VC-001** | `onlineManager.setOnline(navigator.onLine)` is called before `PersistQueryClientProvider` mounts | Code review of `main.tsx` |
| **VC-002** | Persisted `localStorage` data does NOT contain session `token` field | Inspect `localStorage` item after login, search for `token` |
| **VC-003** | Only `['session']` and `['permissions']` queries are persisted | Inspect `localStorage` item, verify no other query keys |
| **VC-004** | App renders dashboard (not /signin) when reloaded offline with valid cached session | DevTools Network throttling + hard reload |
| **VC-005** | `useSession()` from better-auth/react is NOT imported in any component file | Grep for `useSession` in `src/` excluding `auth-client.ts` |
| **VC-006** | `useActiveOrganization()` from better-auth/react is NOT imported in any component file | Grep for `useActiveOrganization` in `src/` excluding `auth-client.ts` |
| **VC-007** | `useActiveMember()` from better-auth/react is NOT imported in `settings/index.tsx` | Grep |
| **VC-008** | `useListOrganizations()` from better-auth/react is NOT imported in `organizations.tsx` | Grep |
| **VC-009** | Sign-out clears `['session']`, `['permissions']`, `['active-member']`, `['organizations']` from cache and localStorage | Sign out, inspect `localStorage` |
| **VC-010** | Auth action handlers in organizations.tsx (3), settings/index.tsx (2), products/index.tsx (1) have try/catch | Code review |
| **VC-011** | `bun check` passes (lint, format, typecheck) | CI |

## 11. Changelog (from previous version)

### Added

- TanStack Query cache persistence for session and permissions queries via `@tanstack/react-query-persist-client`
- `onlineManager.setOnline(navigator.onLine)` initialization fix before React renders
- Selective dehydration filter (`shouldDehydrateQuery`) for auth queries only
- Session token stripping before persistence (SEC-001 compliance)
- `networkMode: 'offlineFirst'` on session and permissions query options
- `activeMemberQueryOptions` wrapping `authClient.organization.getActiveMember()`
- `listOrganizationsQueryOptions` wrapping `authClient.organization.list()`
- Offline-safe route guard pattern (catch + getQueryData fallback)
- Persisted cache cleanup on sign-out
- Try/catch for 6 P1 unhandled throw locations

### Changed

- `QueryClientProvider` replaced with `PersistQueryClientProvider` in `main.tsx`
- `useSession()` (better-auth/react) replaced with `useQuery(sessionQueryOptions)` in DashboardLayout, settings, _dashboard/index
- `useActiveOrganization()` (better-auth/react) replaced with derivation from session data
- `useActiveMember()` (better-auth/react) replaced with `useQuery(activeMemberQueryOptions)` in settings
- `useListOrganizations()` (better-auth/react) replaced with `useQuery(listOrganizationsQueryOptions)` in organizations
- Route guards in `_dashboard/route.tsx` and `organizations.tsx` updated with offline-safe error handling

### Removed

- better-auth React hook imports (`useSession`, `useActiveOrganization`, `useActiveMember`, `useListOrganizations`) from component files (re-exports remain in `auth-client.ts` for `signIn`, `signOut`, `signUp`)

### Rationale

The v1 offline-first spec covered Dexie-based data sync and offline mutation queues for POS. However, it assumed the user's session would survive in TanStack Query's memory cache. In practice, TanStack Query's memory cache is lost on page reload, causing the PWA to redirect to `/signin` when offline. This v2 spec addresses the auth persistence gap and eliminates the dual-fetch anti-pattern that prevented proper offline auth support.

## 12. Related Specifications / Further Reading

- [Offline-First Architecture v1](./spec-v1.md) — Dexie read cache, mutation queue, sync pipeline, Service Worker caching
- [Auth Infrastructure v1](../auth/spec-v1.md) — better-auth configuration, session management, RBAC, frontend auth client
- [Sync Module v1](../sync/spec-v1.md) — Backend sync endpoints, delta sync, batch mutations
- [TanStack Query Persist Client docs](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) — Official persistence documentation
- [TanStack Query Discussion #7027](https://github.com/TanStack/query/discussions/7027) — `onlineManager` offline startup issue (TkDodo confirmation)
- [TanStack Query Issue #10142](https://github.com/TanStack/query/issues/10142) — Related `onlineManager` issue
- [TanStack Query Discussion #2207](https://github.com/TanStack/query/discussions/2207) — `shouldDehydrateQuery` and error state behavior
- [better-auth Organization Plugin](https://www.better-auth.com/plugins/organization) — Organization client API reference
