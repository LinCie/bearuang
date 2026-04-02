import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '#components/ui/button'
import { useHasPermission } from '#lib/use-permissions'

interface ProductDetailHeaderProps {
  product: {
    id: string
    name: string
    slug: string
    isActive: boolean
    updatedAt: string
  }
  onEdit: () => void
  onDelete: () => void
}

export function ProductDetailHeader({
  product,
  onEdit,
  onDelete,
}: ProductDetailHeaderProps) {
  const canUpdate = useHasPermission('product:update')

  return (
    <div className="flex items-start justify-between gap-4 lg:gap-5">
      <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
        <div className="pt-1.5 shrink-0">
          <Link to="/products">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
              aria-label="Kembali ke Katalog"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight wrap-break-word">
            {product.name || 'Produk Tanpa Nama'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  product.isActive
                    ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                    : 'bg-muted-foreground/40'
                }`}
              />
              {product.isActive ? 'Tersedia' : 'Diarsipkan'}
            </span>
            <span className="opacity-30">•</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                /{product.slug}
              </span>
            </span>
            <span className="opacity-30">•</span>
            <span>
              Diperbarui{' '}
              {product.updatedAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(product.updatedAt))
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
            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={onEdit}
            title="Edit produk"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit produk</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onDelete}
          title="Hapus produk"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus produk</span>
        </Button>
      </div>
    </div>
  )
}
