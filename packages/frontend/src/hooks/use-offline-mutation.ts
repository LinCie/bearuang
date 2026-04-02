import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  enqueueMutation,
  generateTempId,
  getQueueStats,
  hasPendingMutations,
} from '#lib/mutation-queue'
import { processMutationQueue } from '#lib/sync'

interface UseOfflineMutationOptions<TInput, TResult> {
  model: string
  operation: 'create' | 'update' | 'delete'
  mutationFn: (input: TInput) => Promise<TResult>
  onOnlineSuccess?: (result: TResult, input: TInput) => void
  onOfflineEnqueue?: (tempId: string, input: TInput) => void
  onSuccess?: (
    result: TResult | { tempId: string; offline: true },
    input: TInput,
  ) => void
  onError?: (error: Error, input: TInput) => void
  invalidateKeys?: readonly (readonly string[])[]
}

interface UseOfflineMutationResult<TInput, TResult> {
  mutate: (
    input: TInput,
  ) => Promise<TResult | { tempId: string; offline: true }>
  mutateAsync: (
    input: TInput,
  ) => Promise<TResult | { tempId: string; offline: true }>
  isPending: boolean
  isOffline: boolean
  pendingCount: number
  syncNow: () => Promise<void>
  error: Error | null
}

export function useOfflineMutation<TInput extends object, TResult = unknown>(
  options: UseOfflineMutationOptions<TInput, TResult>,
): UseOfflineMutationResult<TInput, TResult> {
  const {
    model,
    operation,
    mutationFn,
    onOnlineSuccess,
    onOfflineEnqueue,
    onSuccess,
    onError,
    invalidateKeys,
  } = options

  const queryClient = useQueryClient()
  const [isPending, setIsPending] = React.useState(false)
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine)
  const [pendingCount, setPendingCount] = React.useState(0)
  const [error, setError] = React.useState<Error | null>(null)

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

  React.useEffect(() => {
    let cancelled = false

    getQueueStats()
      .then((stats) => {
        if (!cancelled) setPendingCount(stats.pending + stats.syncing)
      })
      .catch(() => {})

    const interval = setInterval(() => {
      getQueueStats()
        .then((stats) => {
          if (!cancelled) setPendingCount(stats.pending + stats.syncing)
        })
        .catch(() => {})
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const mutateAsync = React.useCallback(
    async (
      input: TInput,
    ): Promise<TResult | { tempId: string; offline: true }> => {
      setIsPending(true)
      setError(null)

      if (navigator.onLine) {
        try {
          const result = await mutationFn(input)
          onOnlineSuccess?.(result, input)
          onSuccess?.(result, input)

          if (invalidateKeys) {
            for (const key of invalidateKeys) {
              queryClient.invalidateQueries({ queryKey: key })
            }
          }

          return result
        } catch (err) {
          const isNetworkError =
            err instanceof TypeError ||
            (err instanceof Error &&
              (err.message.includes('fetch') ||
                err.message.includes('network') ||
                err.message.includes('Failed to fetch')))

          if (!isNetworkError) {
            const mutationError =
              err instanceof Error ? err : new Error(String(err))
            setError(mutationError)
            onError?.(mutationError, input)
            throw mutationError
          }

          return enqueueOffline(input)
        } finally {
          setIsPending(false)
        }
      }

      try {
        return await enqueueOffline(input)
      } finally {
        setIsPending(false)
      }
    },
    [
      mutationFn,
      model,
      operation,
      queryClient,
      invalidateKeys,
      onOnlineSuccess,
      onOfflineEnqueue,
      onSuccess,
      onError,
    ],
  )

  const enqueueOffline = React.useCallback(
    async (input: TInput): Promise<{ tempId: string; offline: true }> => {
      const tempId = generateTempId()

      await enqueueMutation({
        tempId,
        model,
        operation,
        data: input as Record<string, unknown>,
      })

      onOfflineEnqueue?.(tempId, input)

      const stats = await getQueueStats()
      setPendingCount(stats.pending + stats.syncing)

      const result = { tempId, offline: true as const }
      onSuccess?.(result, input)

      return result
    },
    [model, operation, onOfflineEnqueue, onSuccess],
  )

  const syncNow = React.useCallback(async () => {
    if (!navigator.onLine) return

    const hasPending = await hasPendingMutations()
    if (!hasPending) return

    const response = await processMutationQueue()

    if (response) {
      const successResults = response.results.filter(
        (r) => r.status === 'success',
      )
      if (successResults.length > 0 && invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key })
        }
      }
    }

    const stats = await getQueueStats()
    setPendingCount(stats.pending + stats.syncing)
  }, [queryClient, invalidateKeys])

  return {
    mutate: mutateAsync,
    mutateAsync,
    isPending,
    isOffline,
    pendingCount,
    syncNow,
    error,
  }
}
