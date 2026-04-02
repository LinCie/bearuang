import { db } from './db'
import type { MutationQueueItem } from './db'

const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000

type MutationStatus = MutationQueueItem['status']

interface EnqueueOptions {
  tempId: string
  model: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  dependsOn?: number
}

interface ProcessResult {
  tempId: string
  serverId?: string
  status: 'success' | 'conflict' | 'failed'
  conflictData?: unknown
  error?: string
}

export interface SyncBatchResponse {
  results: ProcessResult[]
}

export async function enqueueMutation(
  options: EnqueueOptions,
): Promise<number> {
  const item: MutationQueueItem = {
    tempId: options.tempId,
    createdAt: new Date().toISOString(),
    syncedAt: null,
    status: 'pending',
    model: options.model,
    operation: options.operation,
    data: options.data,
    error: null,
    retries: 0,
    dependsOn: options.dependsOn ?? null,
  }

  return db.mutationQueue.add(item)
}

export async function getPendingMutations(): Promise<MutationQueueItem[]> {
  const pending = await db.mutationQueue
    .where('status')
    .equals('pending')
    .sortBy('createdAt')

  return pending.filter((m) => {
    if (m.dependsOn == null) return true
    return false
  })
}

export async function getAllPendingMutations(): Promise<MutationQueueItem[]> {
  return db.mutationQueue.where('status').equals('pending').sortBy('createdAt')
}

export async function getMutationsByStatus(
  status: MutationStatus,
): Promise<MutationQueueItem[]> {
  return db.mutationQueue.where('status').equals(status).toArray()
}

export async function getConflictMutations(): Promise<MutationQueueItem[]> {
  return db.mutationQueue.where('status').equals('conflict').toArray()
}

export async function getFailedMutations(): Promise<MutationQueueItem[]> {
  return db.mutationQueue.where('status').equals('failed').toArray()
}

export async function updateMutationStatus(
  id: number,
  status: MutationStatus,
  error?: string,
): Promise<void> {
  const updates: Partial<MutationQueueItem> = { status }
  if (error !== undefined) {
    updates.error = error
  }
  if (status === 'syncing') {
    updates.syncedAt = null
  }
  await db.mutationQueue.update(id, updates)
}

export async function markMutationSynced(id: number): Promise<void> {
  await db.mutationQueue.update(id, {
    status: 'pending',
    syncedAt: new Date().toISOString(),
  })
  await db.mutationQueue.delete(id)
}

export async function markMutationConflict(
  id: number,
  conflictData: unknown,
): Promise<void> {
  await db.mutationQueue.update(id, {
    status: 'conflict',
    error:
      typeof conflictData === 'string'
        ? conflictData
        : JSON.stringify(conflictData),
  })
}

export async function markMutationFailed(
  id: number,
  error: string,
): Promise<void> {
  const mutation = await db.mutationQueue.get(id)
  if (!mutation) return

  const newRetries = mutation.retries + 1

  if (newRetries >= MAX_RETRIES) {
    await db.mutationQueue.update(id, {
      status: 'failed',
      retries: newRetries,
      error,
    })
  } else {
    await db.mutationQueue.update(id, {
      status: 'pending',
      retries: newRetries,
      error,
    })
  }
}

export async function retryMutation(id: number): Promise<void> {
  await db.mutationQueue.update(id, {
    status: 'pending',
    error: null,
  })
}

export async function discardMutation(id: number): Promise<void> {
  await db.mutationQueue.delete(id)
}

export async function clearCompletedMutations(): Promise<void> {
  await db.mutationQueue.where('status').anyOf('failed', 'conflict').delete()
}

export async function getQueueStats(): Promise<{
  pending: number
  syncing: number
  failed: number
  conflict: number
}> {
  const [pending, syncing, failed, conflict] = await Promise.all([
    db.mutationQueue.where('status').equals('pending').count(),
    db.mutationQueue.where('status').equals('syncing').count(),
    db.mutationQueue.where('status').equals('failed').count(),
    db.mutationQueue.where('status').equals('conflict').count(),
  ])

  return { pending, syncing, failed, conflict }
}

export function getRetryDelay(retries: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, retries)
}

export async function buildBatchPayload(): Promise<
  Array<{
    tempId: string
    model: string
    operation: 'create' | 'update' | 'delete'
    data: Record<string, unknown>
  }>
> {
  const pending = await getPendingMutations()

  return pending.map((m) => ({
    tempId: m.tempId,
    model: m.model,
    operation: m.operation,
    data: m.data,
  }))
}

export async function processSyncResults(
  results: ProcessResult[],
): Promise<void> {
  for (const result of results) {
    const mutation = await db.mutationQueue
      .where('tempId')
      .equals(result.tempId)
      .first()

    if (!mutation?.id) continue

    switch (result.status) {
      case 'success':
        await markMutationSynced(mutation.id)
        break
      case 'conflict':
        await markMutationConflict(mutation.id, result.conflictData)
        break
      case 'failed':
        await markMutationFailed(mutation.id, result.error ?? 'Unknown error')
        break
    }
  }
}

export async function getPendingCount(): Promise<number> {
  return db.mutationQueue.where('status').equals('pending').count()
}

export async function hasPendingMutations(): Promise<boolean> {
  const count = await getPendingCount()
  return count > 0
}

export function generateTempId(): string {
  return `offline_${crypto.randomUUID()}`
}

export type { ProcessResult, EnqueueOptions }
