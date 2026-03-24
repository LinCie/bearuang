import { RefreshCcw } from 'lucide-react'

interface MovementLoadingStateProps {
  message?: string
}

export function MovementLoadingState({
  message = 'Beruang sedang mengambil data pergerakan stok...',
}: MovementLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-500 motion-safe:animate-in motion-reduce:animate-none">
      <div className="relative flex items-center justify-center h-20 w-20 mb-6">
        <div className="absolute inset-0 rounded-3xl bg-amber-500/15 animate-ping opacity-75 duration-1000 motion-safe:animate-ping motion-reduce:animate-none" />
        <div className="relative flex items-center justify-center h-full w-full rounded-2xl bg-amber-50 border border-amber-200/50 text-amber-600 shadow-sm transition-transform hover:scale-105 motion-reduce:transition-none">
          <RefreshCcw
            className="h-8 w-8 animate-pulse motion-safe:animate-pulse motion-reduce:animate-none"
            strokeWidth={1.5}
          />
        </div>
      </div>
      <p className="text-sm font-medium text-amber-800/70 animate-pulse motion-safe:animate-pulse motion-reduce:animate-none">
        {message}
      </p>
    </div>
  )
}
