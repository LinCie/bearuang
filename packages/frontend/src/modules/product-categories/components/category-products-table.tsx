import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { Package, PackageOpen, Eye } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'
import { useCategoryProducts } from '../hooks/use-product-categories'
import type { Product } from '#modules/products/index'
import { useDebounce } from '#hooks/use-debounce'

interface CategoryProductsTableProps {
  categoryId: string
  hasChildren: boolean
}

export function CategoryProductsTable({
  categoryId,
  hasChildren,
}: CategoryProductsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 300)

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const { data, isLoading, isError } = useCategoryProducts(categoryId, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const products: Product[] = (data?.data ?? []) as unknown as Product[]
  const meta = data?.meta

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: 'image',
        header: () => <span className="sr-only">Gambar</span>,
        cell: ({ row }) => {
          const url = row.original.images[0]?.media.url
          return (
            <div className="size-15 rounded-md overflow-hidden bg-muted flex-shrink-0">
              {url ? (
                <img
                  src={url}
                  alt={row.original.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                  <Package className="size-15" />
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <Link
              to="/products/$productId"
              params={{ productId: row.original.id }}
              className="font-medium text-foreground truncate hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-sm w-fit"
              title={row.original.name}
            >
              {row.original.name}
            </Link>
            {row.original.description && (
              <span
                className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
                title={row.original.description}
              >
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      ...(hasChildren
        ? [
            {
              accessorKey: 'category' as const,
              header: 'Kategori',
              cell: ({ row }: { row: { original: Product } }) => (
                <span className="text-sm text-muted-foreground">
                  {row.original.category?.name ?? '-'}
                </span>
              ),
            },
          ]
        : []),
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              row.original.isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                row.original.isActive ? 'bg-primary' : 'bg-muted-foreground/40'
              }`}
            />
            {row.original.isActive ? 'Aktif' : 'Nonaktif'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} title="Dibuat" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover/row:opacity-100">
            <Link
              to="/products/$productId"
              params={{ productId: row.original.id }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Lihat detail produk"
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Lihat detail produk</span>
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [hasChildren],
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
    <DataTable
      table={table}
      isLoading={isLoading}
      isError={isError}
      loadingState={{
        icon: Package,
        title: 'Menata etalase produk',
        description:
          'Tunggu sebentar ya, kami sedang merapikan rak katalog Anda',
      }}
      errorState={{
        title: 'Aduh, gagal memuat produk.',
        description:
          'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
        onRetry: () => window.location.reload(),
      }}
      searchEmptyState={{
        onClear: () => setSearch(''),
        title: 'Hmm, dicari-cari kok tidak ada',
      }}
      emptyState={{
        icon: PackageOpen,
        title: 'Belum ada produk dalam kategori ini',
        description:
          'Produk yang ditambahkan ke kategori ini atau sub-kategorinya akan muncul di sini.',
      }}
      search={search}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Cari produk..."
      searchAriaLabel="Cari produk dalam kategori"
      pagination={pagination}
      onPaginationChange={setPagination}
      meta={meta}
      itemLabel="produk"
      getHeaderClassName={(id) => (id === 'image' ? 'w-15' : undefined)}
    />
  )
}
