import { cn } from '@/lib/utils'

interface PendingComponentProps {
  /**
   * If true, forces the component to take up the full viewport height.
   * Useful for root-level route loading states.
   * @default false
   */
  fullScreen?: boolean
  /**
   * Optional custom class names for the container
   */
  className?: string
}

export function PendingComponent({ className }: PendingComponentProps = {}) {
  return (
    <div
      className={cn(
        'flex min-h-svh w-full flex-col items-center justify-center gap-4 p-8 text-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes subtle-breathe {
          0%, 100% { opacity: 0.4; transform: scale(0.99); }
          50% { opacity: 1; transform: scale(1); }
        }
        .animate-breathe {
          animation: subtle-breathe 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Bespoke Autumn Warm Skeleton - Replaces generic dots */}
      <div
        className="flex flex-col items-center gap-3 w-max opacity-80"
        aria-hidden="true"
      >
        {/* Abstract header/title block */}
        <div className="h-4 w-32 rounded-full bg-orange-900/10 dark:bg-orange-100/10 animate-breathe" />

        {/* Abstract structural blocks representing data rows or cards */}
        <div className="flex gap-2">
          <div
            className="h-12 w-16 rounded-xl bg-orange-900/5 dark:bg-orange-100/5 animate-breathe"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="h-12 w-32 rounded-xl bg-orange-900/5 dark:bg-orange-100/5 animate-breathe"
            style={{ animationDelay: '200ms' }}
          />
          <div
            className="h-12 w-12 rounded-xl bg-orange-900/5 dark:bg-orange-100/5 animate-breathe"
            style={{ animationDelay: '400ms' }}
          />
        </div>
      </div>

      {/* Polite copy that only appears if the load takes longer than 500ms, preventing flash */}
      <p className="text-sm font-medium text-orange-900/60 dark:text-orange-100/60 animate-in fade-in slide-in-from-bottom-1 duration-1000 delay-500 fill-mode-both">
        Just a moment...
      </p>

      <span className="sr-only">Loading content...</span>
    </div>
  )
}
