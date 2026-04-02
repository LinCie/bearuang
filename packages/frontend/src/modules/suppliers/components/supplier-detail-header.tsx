import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '#components/ui/button'
import { useHasPermission } from '#lib/use-permissions'

interface SupplierDetailHeaderProps {
  supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  onEdit: () => void
  onDelete: () => void
}

export function SupplierDetailHeader({
  supplier,
  onEdit,
  onDelete,
}: SupplierDetailHeaderProps) {
  const canUpdate = useHasPermission('supplier:update')
  return (
    <div className="flex items-start justify-between gap-4 lg:gap-5">
      <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
        <div className="pt-1.5 shrink-0">
          <Link to="/suppliers">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
              aria-label="Kembali ke Daftar Pemasok"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight wrap-break-word">
            {supplier.name || 'Pemasok Tanpa Nama'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  supplier.isActive ? 'bg-amber-500' : 'bg-muted-foreground/40'
                }`}
              />
              {supplier.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
            <span className="opacity-30">•</span>
            <span>
              Dibuat{' '}
              {supplier.createdAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(supplier.createdAt))
                : '-'}
            </span>
            <span className="opacity-30">•</span>
            <span>
              Diperbarui{' '}
              {supplier.updatedAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(supplier.updatedAt))
                : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Edit & Delete Buttons */}
      <div className="flex items-center gap-1 shrink-0 pt-1.5">
        {canUpdate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={onEdit}
            title="Edit pemasok"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit pemasok</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onDelete}
          title="Hapus pemasok"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus pemasok</span>
        </Button>
      </div>
    </div>
  )
}
