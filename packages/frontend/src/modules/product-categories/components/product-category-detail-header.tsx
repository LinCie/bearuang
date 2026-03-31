import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/lib/use-permissions'

interface ProductCategoryDetailHeaderProps {
  category: {
    id: string
    name: string
    slug: string
    parentId: string | null
    parent: { id: string; name: string; slug: string } | null
    isActive: boolean
    createdAt: string
    updatedAt: string
    _count: { products: number }
  }
  onEdit: () => void
  onDelete: () => void
}

export function ProductCategoryDetailHeader({
  category,
  onEdit,
  onDelete,
}: ProductCategoryDetailHeaderProps) {
  const canUpdate = useHasPermission('productCategory:update')

  return (
    <div className="flex items-start justify-between gap-4 lg:gap-5">
      <div className="flex items-start gap-4 lg:gap-5 min-w-0 flex-1">
        <div className="pt-1.5 shrink-0">
          <Link to="/product-categories">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-amber-700 hover:bg-amber-100/40 transition-all hover:-translate-x-1 duration-200"
              aria-label="Kembali ke Daftar Kategori"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-medium text-foreground tracking-tight wrap-break-word">
            {category.name || 'Kategori Tanpa Nama'}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-foreground/80 border border-border/30">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  category.isActive ? 'bg-amber-500' : 'bg-muted-foreground/40'
                }`}
              />
              {category.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
            {category.parent && (
              <>
                <span className="opacity-30">•</span>
                <Link
                  to="/product-categories/$categoryId"
                  params={{ categoryId: category.parent.id }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {category.parent.name}
                </Link>
              </>
            )}
            <span className="opacity-30">•</span>
            <span>{category._count.products} produk</span>
            <span className="opacity-30">•</span>
            <span>
              Dibuat{' '}
              {category.createdAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(category.createdAt))
                : '-'}
            </span>
            <span className="opacity-30">•</span>
            <span>
              Diperbarui{' '}
              {category.updatedAt
                ? new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(category.updatedAt))
                : '-'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 pt-1.5">
        {canUpdate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={onEdit}
            title="Edit kategori"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit kategori</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={onDelete}
          title="Hapus kategori"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus kategori</span>
        </Button>
      </div>
    </div>
  )
}
