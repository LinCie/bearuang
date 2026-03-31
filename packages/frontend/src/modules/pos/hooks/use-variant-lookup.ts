import { useState, useCallback } from 'react'
import { api } from '@/lib/api'

export function useVariantLookup() {
  const [isLooking, setIsLooking] = useState(false)

  const lookupBySku = useCallback(async (sku: string) => {
    setIsLooking(true)
    try {
      const { data, error } = await api.variants.lookup.get({ query: { sku } })
      if (error) return null
      return data
    } catch {
      return null
    } finally {
      setIsLooking(false)
    }
  }, [])

  return { lookupBySku, isLooking }
}
