import { useLiveQuery } from 'dexie-react-hooks'
import type Dexie from 'dexie'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/db'
import type { SyncableTable, SYNCABLE_TABLES } from '@/lib/db'
import { subscribeSyncStatus, getSyncStatus } from '@/lib/sync'
import * as React from 'react'

const MODEL_TO_TABLE = {
  products: 'products',
  variants: 'variants',
  categories: 'productCategories',
  customers: 'customers',
  warehouses: 'warehouses',
  suppliers: 'suppliers',
} satisfies Record<string, SyncableTable>

type TableName = (typeof SYNCABLE_TABLES)[number]

interface UseOfflineDataOptions {
  enabled?: boolean
  orgFilter?: string
}

interface UseOfflineDataResult<T> {
  data: T[] | undefined
  isOffline: boolean
  isSyncing: boolean
  error: Error | null
}

function resolveTableName(model: string): TableName | undefined {
  const key = model as keyof typeof MODEL_TO_TABLE
  return key in MODEL_TO_TABLE ? MODEL_TO_TABLE[key] : undefined
}

function getTable(name: TableName) {
  return db[name]
}

function useOfflineData<T>(
  model: string,
  queryFn: () => Promise<T[]>,
  options?: UseOfflineDataOptions,
): UseOfflineDataResult<T> {
  const { enabled = true, orgFilter } = options ?? {}
  const tableName = resolveTableName(model)

  const [isSyncing, setIsSyncing] = React.useState(
    () => getSyncStatus() === 'syncing',
  )
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine)

  React.useEffect(() => {
    const unsub = subscribeSyncStatus((status) => {
      setIsSyncing(status === 'syncing')
    })
    return unsub
  }, [])

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const cachedData = useLiveQuery(async () => {
    if (!enabled || !tableName) return undefined

    const table = getTable(tableName)
    const collection = orgFilter
      ? table.where('organizationId').equals(orgFilter)
      : table.toCollection()
    return collection.toArray() as unknown as Promise<T[] | undefined>
  }, [tableName, enabled, orgFilter])

  const queryResult = useQuery({
    queryKey: ['offline-data', model, orgFilter],
    queryFn: async () => {
      const result = await queryFn()
      if (tableName && Array.isArray(result)) {
        const table = getTable(tableName) as Dexie.Table
        await table.bulkPut(result)
      }
      return result
    },
    enabled: enabled && navigator.onLine,
    staleTime: 1000 * 60 * 5,
  })

  const data = queryResult.data ?? cachedData
  const error = queryResult.error

  return { data, isOffline, isSyncing, error }
}

export { useOfflineData }
