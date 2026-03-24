import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StockMovement, StockMovementType } from '@/modules/stock-movements'

interface MovementDetailHeaderProps {
  movement: StockMovement
  onEdit: () => void
  onDelete: () => void
}

function getTypeBadgeStyles(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    case 'OUT':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    case 'ADJUSTMENT':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function getTypeLabel(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'Masuk'
    case 'OUT':
      return 'Keluar'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    default:
      return type
  }
}

function getTypeIcon(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return <ArrowUpRight className="h-4 w-4" />
    case 'OUT':
      return <ArrowDownRight className="h-4 w-4" />
    case 'ADJUSTMENT':
      return <RefreshCcw className="h-4 w-4" />
    default:
      return null
  }
}

export function MovementDetailHeader({
  movement,
  onEdit,
  onDelete,
}: MovementDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 lg:gap-5">
      <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
        <div className="pt-1.5 shrink-0">
          <Link to="/stock-movements" search={{ warehouseId: '', variantId: '' }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
              aria-label="Kembali ke Daftar Pergerakan Stok"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight">
              Pergerakan Stok
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getTypeBadgeStyles(movement.type)}`}
            >
              {getTypeIcon(movement.type)}
              {getTypeLabel(movement.type)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30 font-mono">
              ID: {movement.id.slice(0, 8)}...{movement.id.slice(-4)}
            </span>
            <span className="opacity-30">•</span>
            <span>
              {new Intl.DateTimeFormat('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(movement.createdAt))}
            </span>
          </div>
        </div>
      </div>

      {/* Edit & Delete Buttons */}
      <div className="flex items-center gap-1 shrink-0 pt-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          onClick={onEdit}
          title="Edit pergerakan stok"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit pergerakan stok</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onDelete}
          title="Hapus pergerakan stok"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus pergerakan stok</span>
        </Button>
      </div>
    </div>
  )
}
