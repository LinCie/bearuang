import { AlertCircle } from 'lucide-react'
import { Button } from '#components/ui/button'
import { Link } from '@tanstack/react-router'

interface MovementErrorStateProps {
  onRetry?: () => void
}

export function MovementErrorState({ onRetry }: MovementErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-center h-16 w-16 mb-4 rounded-2xl bg-destructive/10 text-destructive/80">
        <AlertCircle className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-destructive/90 text-sm md:text-base text-center max-w-sm px-4 leading-relaxed mb-6">
        Aduh, sepertinya beruang kami kesasar. Pergerakan stok ini tidak dapat
        ditemukan saat ini.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/stock-movements" search={{ warehouseId: '', variantId: '' }}>
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
