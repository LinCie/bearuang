import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, Tag, Eye } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useProductCategories,
  useCreateProductCategory,
  useUpdateProductCategory,
  useDeleteProductCategory,
  ProductCategoryFormSheet,
  DeleteDialog,
} from '#modules/product-categories/index'
import type {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  ProductCategory as ProductCategoryType,
} from '#modules/product-categories/index'
import { useDebounce } from '#hooks/use-debounce'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/product-categories/')({
  component: ProductCategoriesPage,
  validateSearch: (search): { search?: string } => ({
    search: (search.search as string) || undefined,
  }),
})

function ProductCategoriesPage() {
  const navigate = useNavigate({ from: '/product-categories/' })
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
  const [editingCategory, setEditingCategory] =
    React.useState<ProductCategoryType | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingCategory, setDeletingCategory] =
    React.useState<ProductCategoryType | null>(null)

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | 'sortOrder'
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

  const { data, isLoading, isError } = useProductCategories({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const createCategory = useCreateProductCategory()
  const updateCategory = useUpdateProductCategory()
  const deleteCategory = useDeleteProductCategory()

  const canCreate = useHasPermission('productCategory:create')
  const canUpdate = useHasPermission('productCategory:update')

  const categories = data?.data ?? []
  const meta = data?.meta

  const handleCreate = React.useCallback(() => {
    setEditingCategory(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((category: ProductCategoryType) => {
    setEditingCategory(category)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(
    (category: ProductCategoryType) => {
      setDeletingCategory(category)
      setDeleteDialogOpen(true)
    },
    [],
  )

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingCategory) return
    await deleteCategory.mutateAsync(deletingCategory.id)
    setDeleteDialogOpen(false)
    setDeletingCategory(null)
  }, [deletingCategory, deleteCategory])

  async function handleSubmit(values: {
    name: string
    slug: string
    description: string
    isActive: boolean
    parentId: string | null
  }) {
    if (editingCategory) {
      const input: UpdateProductCategoryInput & { id: string } = {
        id: editingCategory.id,
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        isActive: values.isActive,
        parentId: values.parentId,
      }
      await updateCategory.mutateAsync(input)
    } else {
      const input: CreateProductCategoryInput = {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        isActive: values.isActive,
        parentId: values.parentId,
      }
      await createCategory.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingCategory(null)
  }

  const columns = React.useMemo<ColumnDef<ProductCategoryType>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <Link
              to="/product-categories/$categoryId"
              params={{ categoryId: row.original.id }}
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
        accessorKey: 'slug',
        header: 'Slug',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-mono">
            {row.original.slug}
          </span>
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
              to="/product-categories/$categoryId"
              params={{ categoryId: row.original.id }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Lihat detail kategori"
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Lihat detail kategori</span>
              </Button>
            </Link>
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
                title="Edit kategori"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit kategori</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => handleDeleteClick(row.original)}
              title="Hapus kategori"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus kategori</span>
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate],
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">
            Daftar Kategori Produk
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
            Kelola kategori untuk mengorganisir produk Anda.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={handleCreate}
            size="lg"
            className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tambah Kategori
          </Button>
        )}
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: Tag,
          title: 'Memuat daftar kategori',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data kategori Anda',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar kategori.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        searchEmptyState={{
          onClear: () => setSearch(''),
          title: 'Hmm, dicari-cari kok tidak ada',
        }}
        emptyState={{
          icon: Tag,
          title: 'Belum ada kategori nih!',
          description:
            'Saatnya menambahkan kategori pertama Anda. Dengan kategori, produk akan lebih mudah diorganisir.',
          ...(canCreate && {
            action: {
              label: 'Tambah Kategori Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari kategori berdasarkan nama..."
        searchAriaLabel="Cari kategori"
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="kategori"
      />

      <ProductCategoryFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingCategory(null)
        }}
        category={editingCategory}
        onSubmit={handleSubmit}
        isPending={createCategory.isPending || updateCategory.isPending}
        mode={editingCategory ? 'edit' : 'create'}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus kategori?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {deletingCategory?.name}
            </span>
            . Kategori ini akan dipindahkan ke keranjang sampah. Produk dalam
            kategori ini tidak akan terhapus.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteCategory.isPending}
        confirmLabel="Ya, Hapus Kategori"
      />
    </>
  )
}
