import { api } from './api'
import { db, setLastSync, getLastSync } from './db'
import type { SyncableTable } from './db'
import type Dexie from 'dexie'

type SyncStatus = 'idle' | 'syncing' | 'error'

type Listener = (status: SyncStatus) => void

const listeners = new Set<Listener>()

let currentStatus: SyncStatus = 'idle'
let syncIntervalId: ReturnType<typeof setInterval> | null = null

function setStatus(status: SyncStatus): void {
  currentStatus = status
  for (const listener of listeners) {
    listener(status)
  }
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const MODEL_TO_TABLE: Record<string, SyncableTable> = {
  products: 'products',
  variants: 'variants',
  categories: 'productCategories',
  customers: 'customers',
  warehouses: 'warehouses',
  suppliers: 'suppliers',
}

const ALL_MODELS = Object.keys(MODEL_TO_TABLE)

function getTableName(model: string): SyncableTable | undefined {
  return MODEL_TO_TABLE[model]
}

async function writeRecordsToTable(
  table: SyncableTable,
  records: unknown[],
): Promise<void> {
  if (records.length === 0) return
  const t = db[table] as Dexie.Table
  await t.bulkPut(records)
}

async function syncInitial(models: string[]): Promise<void> {
  if (!navigator.onLine) return

  setStatus('syncing')

  try {
    const modelsParam = models.join(',')
    const response = await api.sync.initial.get({
      query: { models: modelsParam },
    })

    if (!response.data) {
      throw new Error('Failed to fetch initial sync data')
    }
    const { models: modelData, syncTimestamp } = response.data

    await Promise.all(
      Object.entries(modelData).map(async ([model, records]) => {
        const table = getTableName(model)
        if (!table) return
        await writeRecordsToTable(table, records as unknown[])
      }),
    )

    await Promise.all(
      Object.keys(modelData).map((model) => setLastSync(model, syncTimestamp)),
    )
  } catch (err) {
    console.error('[sync] Initial sync failed:', err)
    setStatus('error')
    throw err
  }

  setStatus('idle')
}

async function syncDelta(models: string[]): Promise<void> {
  if (!navigator.onLine) return

  setStatus('syncing')

  try {
    const timestamps = await Promise.all(
      models.map(async (model) => {
        const ts = await getLastSync(model)
        return { model, timestamp: ts ?? new Date(0).toISOString() }
      }),
    )

    let cursor = 0

    while (cursor < timestamps.length) {
      const batch = timestamps.slice(cursor, cursor + 3)
      const results = await Promise.allSettled(
        batch.map(async ({ model, timestamp }) => {
          const response = await api.sync.delta.get({
            query: {
              since: timestamp,
              models: model,
            },
          })

          if (!response.data) {
            throw new Error(`Delta sync failed for ${model}`)
          }
          const data = response.data

          return { model, data }
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const value = result.value
          if (!value.model) continue
          const modelName: string = value.model
          const table = getTableName(modelName)
          if (!table) continue

          const records = value.data.models[modelName]
          if (records) {
            await writeRecordsToTable(table, records as unknown[])
          }
          if (value.data.syncTimestamp) {
            await setLastSync(modelName, value.data.syncTimestamp)
          }
        } else {
          console.error('[sync] Delta batch error:', result.reason)
        }
      }

      cursor += 3
    }
  } catch (err) {
    console.error('[sync] Delta sync failed:', err)
    setStatus('error')
    throw err
  }

  setStatus('idle')
}

export function startBackgroundSync(intervalMs = 5 * 60 * 1000): void {
  stopBackgroundSync()

  syncDelta(ALL_MODELS).catch(() => {})

  syncIntervalId = setInterval(() => {
    if (navigator.onLine) {
      syncDelta(ALL_MODELS).catch(() => {})
    }
  }, intervalMs)
}

export function stopBackgroundSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

export async function syncAllModels(): Promise<void> {
  await syncInitial(ALL_MODELS)
}

export { syncInitial, syncDelta }
