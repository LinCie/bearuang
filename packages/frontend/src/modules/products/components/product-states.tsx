import { PawPrint, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

interface ProductLoadingStateProps {
  message?: string
}

export function ProductLoadingState({
  message = 'Beruang sedang membongkar catatan produk...',
}: ProductLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative flex items-center justify-center h-20 w-20 mb-6">
        <div className="absolute inset-0 rounded-3xl bg-amber-500/15 animate-ping opacity-75 duration-1000" />
        <div className="relative flex items-center justify-center h-full w-full rounded-2xl bg-amber-50 border border-amber-200/50 text-amber-600 shadow-sm transition-transform hover:scale-105">
          <PawPrint className="h-8 w-8 animate-pulse" strokeWidth={1.5} />
        </div>
      </div>
      <p className="text-sm font-medium text-amber-800/70 animate-pulse">
        {message}
      </p>
    </div>
  )
}

interface ProductErrorStateProps {
  onRetry?: () => void
}

export function ProductErrorState({ onRetry }: ProductErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-center h-16 w-16 mb-4 rounded-2xl bg-destructive/10 text-destructive/80">
        <AlertCircle className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-destructive/90 text-sm md:text-base text-center max-w-sm px-4 leading-relaxed mb-6">
        Aduh, sepertinya beruang kami kesasar di gudang. Produk ini tidak dapat
        ditemukan saat ini.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/products">
          <Button variant="ghost" className="hover:bg-muted/50 rounded-full">
            Kembali
          </Button>
        </Link>
        <Button
          variant="outline"
          className="rounded-full border-border/50 hover:bg-muted/30 transition-transform active:scale-95"
          onClick={onRetry ?? (() => window.location.reload())}
        >
          Cari Lagi
        </Button>
      </div>
    </div>
  )
}
