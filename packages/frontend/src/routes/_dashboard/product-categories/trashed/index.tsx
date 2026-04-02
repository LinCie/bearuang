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
  Tag,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  ArrowLeft,
  Trash2,
} from 'lucide-react'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Skeleton } from '#components/ui/skeleton'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#components/ui/alert-dialog'

import {
  useTrashedProductCategories,
  useRestoreProductCategory,
} from '#modules/product-categories/index'
import type { TrashedProductCategory } from '#modules/product-categories/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/product-categories/trashed/')(
  {
    component: TrashedProductCategoriesPage,
    validateSearch: (search): { search?: string } => ({
      search: (search.search as string) || undefined,
    }),
  },
)

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

function TrashedProductCategoriesPage() {
  const navigate = useNavigate({ from: '/product-categories/trashed/' })
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

  const { data, isLoading, isError, refetch } = useTrashedProductCategories({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const restoreCategory = useRestoreProductCategory()
  const canDelete = useHasPermission('productCategory:delete')

  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false)
  const [restoringCategory, setRestoringCategory] =
    React.useState<TrashedProductCategory | null>(null)

  const categories = data?.data ?? []
  const meta = data?.meta

  const handleRestore = React.useCallback(
    async (category: TrashedProductCategory) => {
      try {
        await restoreCategory.mutateAsync(category.id)
        toast.success(`Kategori "${category.name}" telah dipulihkan`)
        setRestoreDialogOpen(false)
        setRestoringCategory(null)
      } catch (error) {
        toast.error(
          `Gagal memulihkan "${category.name}". Periksa koneksi dan coba lagi.`,
        )
      }
    },
    [restoreCategory],
  )

  const openRestoreDialog = React.useCallback(
    (category: TrashedProductCategory) => {
      setRestoringCategory(category)
      setRestoreDialogOpen(true)
    },
    [],
  )

  const columns = React.useMemo<ColumnDef<TrashedProductCategory>[]>(
    () => [
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
        accessorKey: 'slug',
        header: 'Slug',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-mono">
            {row.original.slug}
          </span>
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
                disabled={restoreCategory.isPending}
              >
                <RotateCcw className="h-4 w-4" />
                Pulihkan
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canDelete, restoreCategory.isPending, openRestoreDialog],
  )

  const table = useReactTable({
    data: categories,
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
            to="/product-categories"
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-fit gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Kategori
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-muted-foreground" />
                Kategori Terhapus
              </h2>
              <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
                Daftar kategori yang telah dihapus. Anda dapat memulihkannya
                kembali.
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-md group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-4 w-4" />
          </div>
          <Input
            aria-label="Cari kategori terhapus"
            placeholder="Cari kategori terhapus..."
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
                  <TableHead key={header.id}>
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
            ) : categories.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Tag className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      Tidak ada kategori di tempat sampah
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
          <p>Menampilkan {meta.total} kategori terhapus</p>
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
              Pulihkan &quot;{restoringCategory?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kategori ini akan dikembalikan ke daftar utama.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreCategory.isPending}>
              Batalkan
            </AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() =>
                restoringCategory && handleRestore(restoringCategory)
              }
              disabled={restoreCategory.isPending}
            >
              {restoreCategory.isPending ? 'Memulihkan...' : 'Pulihkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
