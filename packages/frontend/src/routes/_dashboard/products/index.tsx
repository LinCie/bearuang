import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, Package, PackageOpen, Eye } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  ProductFormSheet,
  DeleteDialog,
  productKeys,
} from '#modules/products/index'
import type {
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '#modules/products/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'
import { api } from '#lib/api'

export const Route = createFileRoute('/_dashboard/products/')({
  component: ProductsPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

function ProductsPage() {
  const navigate = useNavigate({ from: '/products/' })
  const { search: searchParam } = Route.useSearch()

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState(searchParam ?? '')
  const debouncedSearch = useDebounce(search, 300)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(
    null,
  )

  const queryClient = useQueryClient()

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(
    null,
  )

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  React.useEffect(() => {
    navigate({
      search: () => ({ search: debouncedSearch || undefined }),
      replace: true,
    })
  }, [debouncedSearch, navigate])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const { data, isLoading, isError } = useProducts({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const canCreate = useHasPermission('product:create')
  const canUpdate = useHasPermission('product:update')

  const products = data?.data ?? []
  const meta = data?.meta

  const handleCreate = React.useCallback(() => {
    setEditingProduct(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((product: Product) => {
    setEditingProduct(product)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((product: Product) => {
    setDeletingProduct(product)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingProduct) return
    await deleteProduct.mutateAsync(deletingProduct.id)
    setDeleteDialogOpen(false)
    setDeletingProduct(null)
  }, [deletingProduct, deleteProduct])

  async function handleSubmit(values: {
    name: string
    slug: string
    description: string
    categoryId: string | null
    isActive: boolean
    pendingImages: { id: string }[]
    removedImageIds: string[]
  }) {
    if (editingProduct) {
      const input: UpdateProductInput & { id: string } = {
        id: editingProduct.id,
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        categoryId: values.categoryId,
        isActive: values.isActive,
      }
      await updateProduct.mutateAsync(input)

      for (const imageId of values.removedImageIds) {
        await api
          .products({ id: editingProduct.id })
          .images({ imageId })
          .delete()
      }
      for (const media of values.pendingImages) {
        await api
          .products({ id: editingProduct.id })
          .images.post({ mediaId: media.id })
      }
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    } else {
      const input: CreateProductInput = {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        categoryId: values.categoryId,
        isActive: values.isActive,
      }
      const created = await createProduct.mutateAsync(input)

      for (const media of values.pendingImages) {
        await api
          .products({ id: created.id })
          .images.post({ mediaId: media.id })
      }
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    }
    setSheetOpen(false)
    setEditingProduct(null)
  }

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
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
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
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus produk"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus produk</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate],
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">
            Katalog Produk
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola daftar barang dan layanan yang ditawarkan toko Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/products/trashed">
            <Button
              variant="outline"
              size="lg"
              className="active:scale-95 shadow-sm"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Produk Terhapus
            </Button>
          </Link>
          {canCreate && (
            <Button
              onClick={handleCreate}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Tambah Produk
            </Button>
          )}
        </div>
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: Package,
          title: 'Menata etalase produk',
          description:
            'Tunggu sebentar ya, kami sedang merapikan rak katalog Anda 🐻',
        }}
        errorState={{
          title: 'Aduh, gagal memuat katalog.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
        }}
        emptyState={{
          icon: PackageOpen,
          title: 'Katalog toko Anda masih kosong! 🐻',
          description:
            'Saatnya menyusun etalase dengan barang dan layanan pertama Anda. Pelanggan di luar sana pasti sudah tidak sabar menunggunya!',
          ...(canCreate && {
            action: {
              label: 'Pajang Produk Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari produk berdasarkan nama atau deskripsi..."
        searchAriaLabel="Cari produk"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="produk"
        getHeaderClassName={(id) => (id === 'image' ? 'w-15' : undefined)}
      />

      <ProductFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingProduct(null)
        }}
        product={editingProduct}
        onSubmit={handleSubmit}
        isPending={createProduct.isPending || updateProduct.isPending}
        mode={editingProduct ? 'edit' : 'create'}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus dari katalog?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {deletingProduct?.name}
            </span>
            . Produk ini akan dipindahkan ke tempat sampah dan dapat dipulihkan
            nanti.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteProduct.isPending}
        confirmLabel="Ya, Hapus Produk"
      />
    </>
  )
}
