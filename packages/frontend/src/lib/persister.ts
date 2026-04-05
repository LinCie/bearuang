import { hydrate } from '@tanstack/react-query'
import type { Query, QueryClient, DehydratedState } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

export const PERSIST_KEY = 'bearuang-query-cache'

/** @param data - Query data that may contain a session with a token field. @returns Data with the session token stripped. */
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

/** @param query - Query to evaluate. @returns Whether the query should be persisted to localStorage. */
export function shouldDehydrateQuery(
  query: Query<unknown, Error, unknown, readonly unknown[]>,
): boolean {
  const key = query.queryKey
  return (
    (key[0] === 'session' || key[0] === 'permissions') &&
    query.state.status === 'success'
  )
}

/** @param data - Persisted client state. @returns JSON string with session tokens stripped. */
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

/** @param client - QueryClient to hydrate. Synchronously restores persisted queries from localStorage. */
export function restoreSync(client: QueryClient): void {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      hydrate(client, parsed.clientState as DehydratedState)
    }
  } catch {
    localStorage.removeItem(PERSIST_KEY)
  }
}

export function createPersister() {
  return createAsyncStoragePersister({
    storage: window.localStorage,
    key: PERSIST_KEY,
    serialize,
  })
}
