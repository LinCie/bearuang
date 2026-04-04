import { Package, SearchX, Plus, ShoppingBag, Sparkles } from 'lucide-react'
import { Button } from '#components/ui/button'
import { cn } from '#lib/utils'
import { TableCell, TableRow } from '#components/ui/table'

export interface LoadingStateConfig {
  icon: React.ElementType
  title: string
  description: string
  iconClassName?: string
}

export interface ErrorStateConfig {
  title: string
  description: string
  retryLabel?: string
  onRetry?: () => void
}

export interface SearchEmptyStateConfig {
  onClear: () => void
  title?: string
  clearLabel?: string
}

export function TableLoadingState({
  colSpan,
  icon: Icon,
  title,
  description,
  iconClassName = 'text-orange-500',
}: LoadingStateConfig & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent border-none">
      <TableCell colSpan={colSpan} className="py-20">
        <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
          <div className="relative mb-8 mt-4 group">
            <div
              className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl animate-pulse"
              style={{ animationDuration: '3s' }}
            />
            <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-50/80 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">
              <Icon
                className={cn('h-9 w-9 animate-bounce', iconClassName)}
                style={{ animationDuration: '1.5s' }}
                strokeWidth={1.5}
              />
            </div>
            <div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/5 dark:bg-white/5 rounded-[100%] blur-[3px] animate-pulse"
              style={{ animationDuration: '1.5s' }}
            />
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-1">
              <span className="inline-block text-orange-900 dark:text-orange-100">
                {title}
              </span>
              <span className="inline-flex gap-0.5 ml-0.5 text-orange-500">
                <span
                  className="animate-bounce"
                  style={{
                    animationDelay: '0ms',
                    animationDuration: '1.5s',
                  }}
                >
                  .
                </span>
                <span
                  className="animate-bounce"
                  style={{
                    animationDelay: '150ms',
                    animationDuration: '1.5s',
                  }}
                >
                  .
                </span>
                <span
                  className="animate-bounce"
                  style={{
                    animationDelay: '300ms',
                    animationDuration: '1.5s',
                  }}
                >
                  .
                </span>
              </span>
            </h3>
            <p className="text-sm text-muted-foreground max-w-[250px] mx-auto text-balance">
              {description}
            </p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function TableErrorState({
  colSpan,
  title,
  description,
  retryLabel = 'Coba Muat Ulang',
  onRetry,
}: ErrorStateConfig & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="text-center py-16">
        <p className="text-destructive font-medium text-lg">{title}</p>
        <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
          {description}
        </p>
        {onRetry && (
          <Button variant="outline" className="px-6" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

export function TableSearchEmptyState({
  colSpan,
  search,
  onClear,
  title = 'Hmm, dicari-cari kok tidak ada 🤔',
  clearLabel = 'Berhenti Mencari',
  icon: Icon = Package,
}: SearchEmptyStateConfig & {
  colSpan: number
  search: string
  icon?: React.ElementType
}) {
  return (
    <TableRow className="hover:bg-transparent border-none">
      <TableCell
        colSpan={colSpan}
        className="text-center py-24 whitespace-normal"
      >
        <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-8 group cursor-default">
            <div className="absolute inset-0 bg-stone-100/80 dark:bg-stone-900/40 rounded-full blur-2xl group-hover:bg-stone-200/80 transition-colors duration-500" />
            <div className="relative flex items-center justify-center">
              <div className="absolute -top-3 -right-3 h-8 w-8 text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500 delay-100">
                <SearchX className="h-full w-full" />
              </div>
              <div className="relative h-20 w-20 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800/50 flex items-center justify-center rotate-3 group-hover:rotate-12 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 shadow-sm group-hover:shadow-md cursor-help">
                <Icon className="h-8 w-8 text-stone-400 dark:text-stone-500 transition-transform duration-500 group-hover:scale-95 group-hover:opacity-80" />
                <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:rotate-[-15deg] transition-all duration-500 delay-75">
                  <SearchX className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                </div>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-medium text-foreground mb-3 transition-colors duration-500 group-hover:text-stone-700 dark:group-hover:text-stone-300 whitespace-normal">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
            Kami sudah mengubrak-abrik gudang tapi tidak menemukan{' '}
            <span className="font-semibold text-foreground">
              &quot;{search}&quot;
            </span>
            . Mungkin ada salah ketik?
          </p>
          <Button
            variant="outline"
            onClick={onClear}
            className="px-8 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
          >
            {clearLabel}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export interface EmptyStateConfig {
  icon: React.ElementType
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ElementType
  }
}

export function TableEmptyState({
  colSpan,
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateConfig & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent border-none">
      <TableCell
        colSpan={colSpan}
        className="text-center py-24 whitespace-normal"
      >
        <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-10 group cursor-default">
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />

            <div className="relative flex items-center justify-center">
              <div className="absolute -top-6 -left-2 h-6 w-6 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-3 group-hover:-rotate-12 transition-all duration-700 delay-100">
                <Sparkles className="h-full w-full" />
              </div>
              <div className="absolute bottom-0 -right-8 h-5 w-5 text-orange-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-500 delay-200">
                <Sparkles className="h-full w-full" />
              </div>

              <div className="absolute -left-6 top-1 h-14 w-14 rounded-2xl bg-orange-100/90 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800/60 flex items-center justify-center -rotate-12 group-hover:-rotate-25 group-hover:-translate-x-3 group-hover:-translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md">
                <ShoppingBag className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="absolute -right-5 -bottom-2 h-12 w-12 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center rotate-12 group-hover:rotate-25 group-hover:translate-x-3 group-hover:translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md delay-75">
                <Plus className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              </div>

              <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                <Icon
                  className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>

          <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
            {description}
          </p>
          {action && (
            <Button
              onClick={action.onClick}
              size="lg"
              className="px-8 h-12 text-base shadow-sm hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
            >
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative flex items-center font-medium">
                {action.icon && <action.icon className="mr-2 h-5 w-5" />}
                {action.label}
              </span>
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
