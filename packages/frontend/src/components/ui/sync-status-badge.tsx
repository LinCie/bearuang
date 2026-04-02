import * as React from 'react'
import { cn } from '#lib/utils'
import { subscribeSyncStatus } from '#lib/sync'
import { getQueueStats } from '#lib/mutation-queue'
import { Cloud, CloudOff, Loader2, Upload } from 'lucide-react'

type BadgeState = 'online' | 'offline' | 'syncing' | 'pending'

interface SyncStatusBadgeProps {
  className?: string
  onClick?: () => void
}

export function SyncStatusBadge({ className, onClick }: SyncStatusBadgeProps) {
  const [state, setState] = React.useState<BadgeState>(() =>
    navigator.onLine ? 'online' : 'offline',
  )
  const [pendingCount, setPendingCount] = React.useState(0)

  React.useEffect(() => {
    const handleOnline = () => {
      setState((prev) => (prev === 'pending' ? 'pending' : 'online'))
    }
    const handleOffline = () => {
      setState('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  React.useEffect(() => {
    const unsub = subscribeSyncStatus((status) => {
      if (status === 'syncing' || status === 'syncing-mutations') {
        setState('syncing')
      } else if (navigator.onLine) {
        setState((prev) => (prev === 'pending' ? 'pending' : 'online'))
      }
    })
    return unsub
  }, [])

  React.useEffect(() => {
    let cancelled = false

    function checkQueue() {
      getQueueStats()
        .then((stats) => {
          if (cancelled) return
          const count = stats.pending + stats.syncing
          setPendingCount(count)
          if (count > 0 && navigator.onLine) {
            setState('pending')
          } else if (count === 0 && navigator.onLine && state === 'pending') {
            setState('online')
          }
        })
        .catch(() => {})
    }

    checkQueue()
    const interval = setInterval(checkQueue, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [state])

  const Icon =
    state === 'syncing'
      ? Loader2
      : state === 'offline'
        ? CloudOff
        : state === 'pending'
          ? Upload
          : Cloud

  const label =
    state === 'online'
      ? 'Online'
      : state === 'syncing'
        ? 'Menyinkronkan...'
        : state === 'pending'
          ? `${pendingCount} menunggu`
          : 'Offline'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        state === 'online' &&
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        state === 'syncing' &&
          'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        state === 'offline' && 'bg-red-500/10 text-red-700 dark:text-red-400',
        state === 'pending' &&
          'bg-orange-500/10 text-orange-700 dark:text-orange-400',
        onClick && 'cursor-pointer hover:opacity-80',
        className,
      )}
      role="status"
      aria-label={label}
    >
      <Icon className={cn('size-3.5', state === 'syncing' && 'animate-spin')} />
      <span>{label}</span>
    </button>
  )
}
