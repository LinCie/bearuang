import type { OrdersVerdict, StockVerdict } from '#modules/dashboard/index'

const VERDICT_BORDER: Record<string, string> = {
  great: 'border-l-emerald-500',
  normal: 'border-l-muted-foreground/30',
  slow: 'border-l-red-500',
  healthy: 'border-l-emerald-500',
  'running-low': 'border-l-amber-500',
  critical: 'border-l-red-500',
}

interface VerdictCardProps {
  verdict: OrdersVerdict | StockVerdict
  loading?: boolean
  children: React.ReactNode
}

export function VerdictCard({
  verdict,
  loading = false,
  children,
}: VerdictCardProps) {
  return (
    <div
      className={`rounded-lg border border-border border-l-4 ${loading ? 'border-l-muted' : (VERDICT_BORDER[verdict] ?? 'border-l-muted-foreground/30')} bg-card p-5`}
    >
      {loading ? (
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-8 w-40 rounded bg-muted animate-pulse" />
          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
