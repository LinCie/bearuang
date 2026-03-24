import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Package,
  PackageOpen,
  SearchX,
  ShoppingBag,
  Sparkles,
  ChevronLeft,
  Search,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  ProductFormSheet,
  DeleteDialog,
} from '@/modules/products'
import type { CreateProductInput, UpdateProductInput } from '@/modules/products'

export const Route = createFileRoute('/_dashboard/products/')({
  component: ProductsPage,
})

// ─── Types ────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  variants: unknown[]
}

// ─── Component ────────────────────────────────────────────────

function ProductsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState('')

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(
    null,
  )

  // Delete dialog state
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

  const { data, isLoading, isError } = useProducts({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
  })

  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const products = (data?.data ?? []) as Product[]
  const meta = data?.meta

  // Client-side search filter
  const filteredProducts = React.useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    )
  }, [products, search])

  // ─── Handlers ──────────────────────────────────────────────

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
    isActive: boolean
  }) {
    if (editingProduct) {
      const input: UpdateProductInput & { id: string } = {
        id: editingProduct.id,
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        isActive: values.isActive,
      }
      await updateProduct.mutateAsync(input)
    } else {
      const input: CreateProductInput = {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        isActive: values.isActive,
      }
      await createProduct.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingProduct(null)
  }

  // ─── Table Columns ─────────────────────────────────────────

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Nama
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        ),
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
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Dibuat
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
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
    [handleEdit, handleDeleteClick],
  )

  const table = useReactTable({
    data: filteredProducts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Page Header & Toolbar */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              Katalog Produk
            </h2>
            <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
              Kelola daftar barang dan layanan yang ditawarkan toko Anda.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            size="lg"
            className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tambah Produk
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-4 w-4" />
          </div>
          <Input
            placeholder="Cari produk berdasarkan nama atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 h-11 bg-card border-border/60 hover:border-border focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl shadow-sm transition-all sm:text-sm"
            aria-label="Cari produk"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
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
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={columns.length} className="py-20">
                  <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="relative mb-8 mt-4 group">
                      <div
                        className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl animate-pulse"
                        style={{ animationDuration: '3s' }}
                      />
                      <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-50/80 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">
                        <Package
                          className="h-9 w-9 text-orange-500 animate-bounce"
                          style={{ animationDuration: '1.5s' }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div
                        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/5 dark:bg-white/5 rounded-[100%] blur-[3px] animate-pulse"
                        style={{ animationDuration: '1.5s' }}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <h3 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-1">
                        <span className="inline-block text-orange-900 dark:text-orange-100">
                          Menata etalase produk
                        </span>
                        <span className="inline-flex gap-0.5 ml-0.5 text-orange-500">
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '0ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '150ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '300ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-[250px] mx-auto text-balance">
                        Tunggu sebentar ya, kami sedang merapikan rak katalog
                        Anda 🐻
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-16"
                >
                  <p className="text-destructive font-medium text-lg">
                    Aduh, gagal memuat katalog.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
                    Sepertinya ada sedikit kendala jaringan. Mari kita coba
                    sekali lagi.
                  </p>
                  <Button
                    variant="outline"
                    className="px-6"
                    onClick={() => window.location.reload()}
                  >
                    Coba Muat Ulang
                  </Button>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24 whitespace-normal"
                >
                  {search ? (
                    <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative mb-8 group cursor-default">
                        <div className="absolute inset-0 bg-stone-100/80 dark:bg-stone-900/40 rounded-full blur-2xl group-hover:bg-stone-200/80 transition-colors duration-500" />

                        <div className="relative flex items-center justify-center">
                          <div className="absolute -top-3 -right-3 h-8 w-8 text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500 delay-100">
                            <SearchX className="h-full w-full" />
                          </div>

                          <div className="relative h-20 w-20 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800/50 flex items-center justify-center rotate-3 group-hover:rotate-12 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 shadow-sm group-hover:shadow-md cursor-help">
                            <Package className="h-8 w-8 text-stone-400 dark:text-stone-500 transition-transform duration-500 group-hover:scale-95 group-hover:opacity-80" />
                            <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:rotate-[-15deg] transition-all duration-500 delay-75">
                              <SearchX className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-medium text-foreground mb-3 transition-colors duration-500 group-hover:text-stone-700 dark:group-hover:text-stone-300 whitespace-normal">
                        Hmm, dicari-cari kok tidak ada 🤔
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                        Kami sudah mengubrak-abrik gudang tapi tidak menemukan{' '}
                        <span className="font-semibold text-foreground">
                          "{search}"
                        </span>
                        . Mungkin ada salah ketik?
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setSearch('')}
                        className="px-8 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
                      >
                        Berhenti Mencari
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                      <div className="relative mb-10 group cursor-default">
                        {/* Decorative background blur to add warmth */}
                        <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />

                        {/* Main icon arrangement */}
                        <div className="relative flex items-center justify-center">
                          {/* Sparkles! */}
                          <div className="absolute -top-6 -left-2 h-6 w-6 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-3 group-hover:-rotate-12 transition-all duration-700 delay-100">
                            <Sparkles className="h-full w-full" />
                          </div>
                          <div className="absolute bottom-0 -right-8 h-5 w-5 text-orange-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-500 delay-200">
                            <Sparkles className="h-full w-full" />
                          </div>

                          <div className="absolute -left-6 top-1 h-14 w-14 rounded-2xl bg-orange-100/90 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800/60 flex items-center justify-center -rotate-12 group-hover:-rotate-25 group-hover:-translate-x-3 group-hover:-translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md">
                            <ShoppingBag className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="absolute -right-5 -bottom-2 h-12 w-12 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center rotate-12 group-hover:rotate-25 group-hover:translate-x-3 group-hover:translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md delay-75">
                            <Plus className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                          </div>

                          <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                            <PackageOpen
                              className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                              strokeWidth={1.5}
                            />
                          </div>
                        </div>
                      </div>

                      <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                        Katalog toko Anda masih kosong! 🐻
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                        Saatnya menyusun etalase dengan barang dan layanan
                        pertama Anda. Pelanggan di luar sana pasti sudah tidak
                        sabar menunggunya!
                      </p>
                      <Button
                        onClick={handleCreate}
                        size="lg"
                        className="px-8 h-12 text-base shadow-sm hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
                      >
                        <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative flex items-center font-medium">
                          <Plus className="mr-2 h-5 w-5" />
                          Pajang Produk Pertama
                        </span>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200"
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

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-border/40 text-sm text-muted-foreground gap-5 sm:gap-0 mx-2 pb-6">
          <p className="text-center sm:text-left text-balance">
            Menampilkan{' '}
            <span className="text-foreground font-medium mx-1">
              {pagination.pageIndex * pagination.pageSize + 1}
            </span>
            –
            <span className="text-foreground font-medium mx-1">
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                meta.total,
              )}
            </span>
            dari{' '}
            <span className="text-foreground font-medium mx-1">
              {meta.total}
            </span>{' '}
            produk
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
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
              className="px-5 shadow-sm"
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

      {/* Create / Edit Sheet */}
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

      {/* Delete Confirmation Dialog */}
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
            . Produk ini akan hilang selamanya dan tidak bisa dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteProduct.isPending}
        confirmLabel="Ya, Hapus Produk"
      />
    </>
  )
}
