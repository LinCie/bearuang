import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WarehouseDetailHeaderProps {
  warehouse: {
    id: string
    name: string
    address: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  onEdit: () => void
  onDelete: () => void
}

export function WarehouseDetailHeader({
  warehouse,
  onEdit,
  onDelete,
}: WarehouseDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 lg:gap-5">
      <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
        <div className="pt-1.5 shrink-0">
          <Link to="/warehouses">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
              aria-label="Kembali ke Daftar Gudang"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight wrap-break-word">
            {warehouse.name || 'Gudang Tanpa Nama'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  warehouse.isActive ? 'bg-amber-500' : 'bg-muted-foreground/40'
                }`}
              />
              {warehouse.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
            <span className="opacity-30">•</span>
            <span>
              Dibuat{' '}
              {warehouse.createdAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(warehouse.createdAt))
                : '-'}
            </span>
            <span className="opacity-30">•</span>
            <span>
              Diperbarui{' '}
              {warehouse.updatedAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(warehouse.updatedAt))
                : '-'}
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
          title="Edit gudang"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit gudang</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onDelete}
          title="Hapus gudang"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus gudang</span>
        </Button>
      </div>
    </div>
  )
}
