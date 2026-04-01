import * as React from 'react'
import { cn } from '@/lib/utils'
import { subscribeSyncStatus } from '@/lib/sync'

type SyncState = 'online' | 'offline' | 'syncing' | 'pending'

export function OfflineIndicator() {
  const [state, setState] = React.useState<SyncState>(() =>
    navigator.onLine ? 'online' : 'offline',
  )

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
      if (status === 'syncing') {
        setState('syncing')
      } else if (navigator.onLine) {
        setState('online')
      }
    })
    return unsub
  }, [])

  const dotClass = cn(
    'size-2 rounded-full shrink-0',
    state === 'online' && 'bg-emerald-500',
    state === 'syncing' && 'bg-amber-500 animate-pulse',
    state === 'offline' && 'bg-red-500',
    state === 'pending' && 'bg-orange-500',
  )

  const label =
    state === 'online'
      ? 'Online'
      : state === 'syncing'
        ? 'Syncing...'
        : state === 'pending'
          ? 'Pending'
          : 'Offline'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        state === 'online' &&
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        state === 'syncing' &&
          'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        state === 'offline' && 'bg-red-500/10 text-red-700 dark:text-red-400',
        state === 'pending' &&
          'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      )}
      role="status"
      aria-label={label}
    >
      <span className={dotClass} />
      <span>{label}</span>
    </div>
  )
}
