import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  ArrowLeft,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { useTrashedProducts, useRestoreProduct } from '@/modules/products'
import type { Product } from '@/modules/products'
import { useDebounce } from '@/hooks/use-debounce'
import { useHasPermission } from '@/lib/use-permissions'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/products/trashed/')({
  component: TrashedProductsPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

interface SortableHeaderProps {
  column: {
    toggleSorting: (desc: boolean) => void
    getIsSorted: () => false | 'asc' | 'desc'
  }
  children: React.ReactNode
}

function SortableHeader({ column, children }: SortableHeaderProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-2 group"
    >
      {children}
      {column.getIsSorted() === 'asc' ? (
        <ArrowUp className="ml-1 h-3.5 w-3.5" />
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </Button>
  )
}

function TableSkeletonRows({
  rows = 5,
  cols = 3,
}: {
  rows?: number
  cols?: number
}) {
  return Array.from({ length: rows }, (__, i) => (
    <TableRow key={i} className="border-b border-border/40">
      {Array.from({ length: cols }, (___, j) => (
        <TableCell key={j}>
          <Skeleton className="h-5 w-full max-w-[180px]" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

function TrashedProductsPage() {
  const navigate = useNavigate({ from: '/products/trashed/' })
  const { search: searchParam } = Route.useSearch()

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState(searchParam ?? '')
  const debouncedSearch = useDebounce(search, 300)

  React.useEffect(() => {
    navigate({
      search: () => ({ search: debouncedSearch || undefined }),
      replace: true,
    })
  }, [debouncedSearch, navigate])

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const { data, isLoading, isError, refetch } = useTrashedProducts({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const restoreProduct = useRestoreProduct()
  const canDelete = useHasPermission('product:delete')

  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false)
  const [restoringProduct, setRestoringProduct] =
    React.useState<Product | null>(null)

  const products = data?.data ?? []
  const meta = data?.meta

  const handleRestore = React.useCallback(
    async (product: Product) => {
      try {
        await restoreProduct.mutateAsync(product.id)
        toast.success(`Produk "${product.name}" telah dipulihkan`)
        setRestoreDialogOpen(false)
        setRestoringProduct(null)
      } catch (error) {
        toast.error(
          `Gagal memulihkan "${product.name}". Periksa koneksi dan coba lagi.`,
        )
      }
    },
    [restoreProduct],
  )

  const openRestoreDialog = React.useCallback((product: Product) => {
    setRestoringProduct(product)
    setRestoreDialogOpen(true)
  }, [])

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: 'image',
        header: () => <span className="sr-only">Gambar</span>,
        cell: ({ row }) => {
          const url = row.original.images[0]?.media.url
          return (
            <div className="w-9 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0">
              {url ? (
                <img
                  src={url}
                  alt={row.original.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                  <Package className="h-4 w-4" />
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortableHeader column={column}>Nama</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <span className="font-medium text-foreground truncate">
              {row.original.name}
            </span>
            {row.original.description && (
              <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <SortableHeader column={column}>Dihapus Pada</SortableHeader>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.updatedAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary hover:bg-primary/10 transition-colors gap-2"
                onClick={() => openRestoreDialog(row.original)}
                disabled={restoreProduct.isPending}
              >
                <RotateCcw className="h-4 w-4" />
                Pulihkan
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canDelete, restoreProduct.isPending, openRestoreDialog],
  )

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  return (
    <>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col gap-4">
          <Link
            to="/products"
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-fit gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Katalog
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-muted-foreground" />
                Produk Terhapus
              </h2>
              <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
                Daftar produk yang telah dihapus. Anda dapat memulihkannya
                kembali ke katalog.
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-md group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-4 w-4" />
          </div>
          <Input
            aria-label="Cari produk terhapus"
            placeholder="Cari produk terhapus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 h-11 bg-card border-border/60 hover:border-border focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl shadow-sm transition-[color,box-shadow,border-color] sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-foreground/5 dark:ring-foreground/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-muted/30 hover:bg-muted/30"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.id === 'image' ? 'w-12' : undefined}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows />
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-16"
                >
                  <p className="text-destructive font-medium text-lg mb-4">
                    Gagal memuat data terhapus.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Coba lagi
                  </Button>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      Tidak ada produk di tempat sampah
                    </h3>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/40 hover:bg-muted/10 transition-colors duration-200"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-border/40 text-sm text-muted-foreground gap-5 sm:gap-0 mx-2 pb-6">
          <p>Menampilkan {meta.total} produk terhapus</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
              }
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
              }
            >
              Selanjutnya
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Pulihkan &quot;{restoringProduct?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Produk ini akan dikembalikan ke katalog utama.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreProduct.isPending}>
              Batalkan
            </AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() =>
                restoringProduct && handleRestore(restoringProduct)
              }
              disabled={restoreProduct.isPending}
            >
              {restoreProduct.isPending ? 'Memulihkan...' : 'Pulihkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
