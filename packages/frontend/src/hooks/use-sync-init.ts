import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQueryOptions } from '#lib/session'
import {
  syncAllModels,
  startBackgroundSync,
  stopBackgroundSync,
} from '#lib/sync'
import { clearOrgData } from '#lib/db'

export function useSyncInit(): void {
  const { data: sessionData } = useQuery(sessionQueryOptions)
  const orgId = sessionData ? sessionData.session.activeOrganizationId : null
  const prevOrgId = React.useRef<string | null>(null)
  const isSynced = React.useRef(false)

  React.useEffect(() => {
    if (!orgId) return

    if (prevOrgId.current && prevOrgId.current !== orgId) {
      clearOrgData(prevOrgId.current).catch(() => {})
      isSynced.current = false
    }

    prevOrgId.current = orgId

    if (!isSynced.current) {
      isSynced.current = true
      syncAllModels()
        .then(() => startBackgroundSync())
        .catch(() => {})
    }

    return () => {
      stopBackgroundSync()
    }
  }, [orgId])
}
