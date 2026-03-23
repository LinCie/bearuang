import { createFileRoute, redirect } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/use-products'
import type {
  CreateProductInput,
  UpdateProductInput,
} from '@/hooks/use-products'

export const Route = createFileRoute('/products')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({ to: '/signin' })
    }
  },
  component: ProductsPage,
})

// ─── Types ────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  variants: unknown[]
}

// ─── Validation Schemas ───────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  description: z.string().optional(),
  isActive: z.boolean(),
})

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

  function handleCreate() {
    setEditingProduct(null)
    setSheetOpen(true)
  }

  function handleEdit(product: Product) {
    setEditingProduct(product)
    setSheetOpen(true)
  }

  function handleDeleteClick(product: Product) {
    setDeletingProduct(product)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deletingProduct) return
    await deleteProduct.mutateAsync(deletingProduct.id)
    setDeleteDialogOpen(false)
    setDeletingProduct(null)
  }

  async function handleSubmit(values: {
    name: string
    description: string
    isActive: boolean
  }) {
    if (editingProduct) {
      const input: UpdateProductInput & { id: string } = {
        id: editingProduct.id,
        name: values.name,
        description: values.description || undefined,
        isActive: values.isActive,
      }
      await updateProduct.mutateAsync(input)
    } else {
      const input: CreateProductInput = {
        name: values.name,
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
            className="-ml-2"
          >
            Nama
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
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
            className="-ml-2"
          >
            Dibuat
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
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
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleEdit(row.original)}
              aria-label={`Edit ${row.original.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleDeleteClick(row.original)}
              aria-label={`Hapus ${row.original.name}`}
              className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
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
    <DashboardLayout>
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-medium text-foreground">Produk</h2>
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4" />
            Tambah Produk
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Kelola daftar produk dan varian Anda.
        </p>
      </header>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-10 bg-muted/40"
          aria-label="Cari produk"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/30 hover:bg-muted/30"
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
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell>
                    <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-12 bg-muted rounded animate-pulse ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-12"
                >
                  <p className="text-destructive font-medium">
                    Gagal memuat produk.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Coba muat ulang halaman.
                  </p>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-16"
                >
                  <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {search ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}
                  </p>
                  {!search && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={handleCreate}
                    >
                      <Plus className="h-4 w-4" />
                      Tambah produk pertama
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <p>
            Menampilkan{' '}
            <span className="text-foreground font-medium">
              {pagination.pageIndex * pagination.pageSize + 1}
            </span>
            –
            <span className="text-foreground font-medium">
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                meta.total,
              )}
            </span>{' '}
            dari{' '}
            <span className="text-foreground font-medium">{meta.total}</span>{' '}
            produk
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
              }
            >
              <ChevronLeft className="h-4 w-4" />
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
              <ChevronRight className="h-4 w-4" />
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
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Produk</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus{' '}
              <span className="font-medium text-foreground">
                {deletingProduct?.name}
              </span>
              ? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteProduct.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

// ─── Product Form Sheet ──────────────────────────────────────

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSubmit: (values: {
    name: string
    description: string
    isActive: boolean
  }) => Promise<void>
  isPending: boolean
}

function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSubmit,
  isPending,
}: ProductFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      isActive: product?.isActive ?? true,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await onSubmit(value)
      } catch (err) {
        const error = err as { message?: string }
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    },
  })

  // Reset form when product changes
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', product?.name ?? '')
      form.setFieldValue('description', product?.description ?? '')
      form.setFieldValue('isActive', product?.isActive ?? true)
      setServerError(null)
    }
  }, [open, product])

  const isEditing = !!product

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHead>
          <SheetTitle>{isEditing ? 'Edit Produk' : 'Tambah Produk'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Perbarui informasi produk Anda.'
              : 'Tambahkan produk baru ke daftar Anda.'}
          </SheetDescription>
        </SheetHead>

        <form
          className="flex flex-col gap-4 px-4 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 font-medium">
              {serverError}
            </p>
          )}

          {/* Name */}
          <form.Field
            name="name"
            validators={{
              onBlur: productSchema.shape.name,
              onSubmit: productSchema.shape.name,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Produk <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: Kopi Arabika Premium"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Description */}
          <form.Field name="description">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Deskripsi
                </Label>
                <textarea
                  id={field.name}
                  placeholder="Deskripsi singkat produk (opsional)"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>
            )}
          </form.Field>

          {/* isActive */}
          <form.Field name="isActive">
            {(field) => (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(Boolean(checked))
                  }
                />
                <Label
                  htmlFor={field.name}
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  Produk aktif
                </Label>
              </div>
            )}
          </form.Field>
        </form>

        <SheetFooter className="px-4 pb-4">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting || isPending}
                  onClick={() => form.handleSubmit()}
                >
                  {isSubmitting || isPending
                    ? 'Menyimpan...'
                    : isEditing
                      ? 'Simpan Perubahan'
                      : 'Tambah Produk'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
