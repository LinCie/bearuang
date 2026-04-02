import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '#components/ui/alert-dialog'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import type { MutationQueueItem } from '#lib/db'

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: MutationQueueItem[]
  onRetry: (id: number) => void
  onDiscard: (id: number) => void
  onRetryAll: () => void
  onDiscardAll: () => void
}

function formatModelName(model: string): string {
  const names: Record<string, string> = {
    'sales-orders': 'Pesanan Penjualan',
    customers: 'Pelanggan',
    products: 'Produk',
    variants: 'Varian',
    warehouses: 'Gudang',
    suppliers: 'Pemasok',
  }
  return names[model] ?? model
}

function formatOperation(operation: string): string {
  const ops: Record<string, string> = {
    create: 'Dibuat',
    update: 'Diperbarui',
    delete: 'Dihapus',
  }
  return ops[operation] ?? operation
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onRetry,
  onDiscard,
  onRetryAll,
  onDiscardAll,
}: ConflictDialogProps) {
  if (conflicts.length === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="size-8 text-amber-500" />
          </AlertDialogMedia>
          <AlertDialogTitle>Konflik Data</AlertDialogTitle>
          <AlertDialogDescription>
            {conflicts.length} perubahan tidak dapat disinkronkan karena konflik
            dengan data server. Periksa dan coba lagi atau buang perubahan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-60 space-y-2 overflow-y-auto">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {formatModelName(conflict.model)} &middot;{' '}
                  {formatOperation(conflict.operation)}
                </div>
                {conflict.error && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conflict.error}
                  </div>
                )}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(conflict.createdAt).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => conflict.id != null && onRetry(conflict.id)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Coba lagi"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => conflict.id != null && onDiscard(conflict.id)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Buang"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscardAll} variant="destructive">
            Buang Semua
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRetryAll}>
            Coba Lagi Semua
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
