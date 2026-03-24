import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  useProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/use-products'
import type { UpdateProductInput } from '@/hooks/use-products'
import {
  useProductVariants,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
} from '@/hooks/use-variants'
import type {
  CreateVariantInput,
  UpdateVariantInput,
} from '@/hooks/use-variants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  PackageOpen,
  Sparkles,
  PawPrint,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'

export const Route = createFileRoute('/_dashboard/products/$productId')({
  component: ProductDetailPage,
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

interface Variant {
  id: string
  productId: string
  sku: string
  name: string
  price: number
  stock: number
  unit: string
  attributes: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Validation Schemas ───────────────────────────────────────

const slugRegex = /^[a-z0-9_-]+$/

const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama produk wajib diisi')
    .max(100, 'Nama produk maksimal 100 karakter'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug wajib diisi')
    .max(100, 'Slug maksimal 100 karakter')
    .regex(
      slugRegex,
      'Slug hanya boleh berisi huruf kecil, angka, strip, dan garis bawah',
    ),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  isActive: z.boolean(),
})

const variantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU wajib diisi'),
  name: z.string().trim().min(1, 'Nama varian wajib diisi'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  unit: z.string().trim().optional(),
  isActive: z.boolean(),
})

// ─── Page Component ───────────────────────────────────────────

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const router = useRouter()
  const { data: product, isLoading, isError } = useProduct(productId)
  const { data: variantsData } = useProductVariants(productId)

  const variants: Variant[] = (variantsData ??
    product?.variants ??
    []) as Variant[]

  // Mutations
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant()
  const deleteVariant = useDeleteVariant()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  // Sheet state (create / edit variant)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingVariant, setEditingVariant] = React.useState<Variant | null>(
    null,
  )

  // Delete dialog state (variant)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingVariant, setDeletingVariant] = React.useState<Variant | null>(
    null,
  )

  // Product edit sheet state
  const [productSheetOpen, setProductSheetOpen] = React.useState(false)

  // Product delete dialog state
  const [productDeleteDialogOpen, setProductDeleteDialogOpen] =
    React.useState(false)

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = React.useCallback(() => {
    setEditingVariant(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((variant: Variant) => {
    setEditingVariant(variant)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((variant: Variant) => {
    setDeletingVariant(variant)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingVariant) return
    await deleteVariant.mutateAsync(deletingVariant.id)
    setDeleteDialogOpen(false)
    setDeletingVariant(null)
  }, [deletingVariant, deleteVariant])

  // Product edit handlers
  const handleProductEdit = React.useCallback(() => {
    setProductSheetOpen(true)
  }, [])

  const handleProductDeleteClick = React.useCallback(() => {
    setProductDeleteDialogOpen(true)
  }, [])

  const handleProductDeleteConfirm = React.useCallback(async () => {
    if (!product) return
    await deleteProduct.mutateAsync(product.id)
    setProductDeleteDialogOpen(false)
    // Navigate back to products list after deletion
    router.navigate({ to: '/products' })
  }, [product, deleteProduct, router])

  async function handleProductSubmit(values: {
    name: string
    slug: string
    description: string
    isActive: boolean
  }) {
    if (!product) return
    const input: UpdateProductInput & { id: string } = {
      id: product.id,
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      isActive: values.isActive,
    }
    await updateProduct.mutateAsync(input)
    setProductSheetOpen(false)
  }

  async function handleSubmit(values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
  }) {
    if (editingVariant) {
      const input: UpdateVariantInput & { id: string } = {
        id: editingVariant.id,
        sku: values.sku,
        name: values.name,
        price: values.price,
        unit: values.unit || undefined,
        isActive: values.isActive,
      }
      await updateVariant.mutateAsync(input)
    } else {
      const input: CreateVariantInput = {
        sku: values.sku,
        name: values.name,
        price: values.price,
        unit: values.unit || undefined,
        isActive: values.isActive,
      }
      await createVariant.mutateAsync(input)
    }
    setSheetOpen(false)
    setEditingVariant(null)
  }

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative flex items-center justify-center h-20 w-20 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-amber-500/15 animate-ping opacity-75 duration-1000" />
            <div className="relative flex items-center justify-center h-full w-full rounded-2xl bg-amber-50 border border-amber-200/50 text-amber-600 shadow-sm transition-transform hover:scale-105">
              <PawPrint className="h-8 w-8 animate-pulse" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-sm font-medium text-amber-800/70 animate-pulse">
            Beruang sedang membongkar catatan produk...
          </p>
        </div>
      </>
    )
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !product) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <div className="flex items-center justify-center h-16 w-16 mb-4 rounded-2xl bg-destructive/10 text-destructive/80">
            <AlertCircle className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <p className="text-destructive/90 text-sm md:text-base text-center max-w-sm px-4 leading-relaxed mb-6">
            Aduh, sepertinya beruang kami kesasar di gudang. Produk ini tidak
            dapat ditemukan saat ini.
          </p>
          <div className="flex items-center gap-3">
            <Link to="/products">
              <Button
                variant="ghost"
                className="hover:bg-muted/50 rounded-full"
              >
                Kembali
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full border-border/50 hover:bg-muted/30 transition-transform active:scale-95"
              onClick={() => window.location.reload()}
            >
              Cari Lagi
            </Button>
          </div>
        </div>
      </>
    )
  }

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={handleProductEdit}
              title="Edit produk"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit produk</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={handleProductDeleteClick}
              title="Hapus produk"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Hapus produk</span>
            </Button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col gap-12 lg:pl-14">
          {/* Description */}
          {product.description && (
            <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap max-w-3xl">
              {product.description}
            </p>
          )}

          {/* Divider */}
          {product.description && <div className="w-full h-px bg-border/20" />}

          {/* Variants Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-foreground">
                Varian ({variants.length})
              </h2>
              <Button
                size="sm"
                onClick={handleCreate}
                className="shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Tambah Varian
              </Button>
            </div>

            <div className="-mx-4 sm:mx-0">
              {variants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border/40 rounded-2xl mx-4 sm:mx-0 hover:border-amber-500/30 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-all duration-500 group cursor-default relative overflow-hidden">
                  <div className="absolute inset-0 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors duration-700" />

                  <div className="relative flex items-center justify-center mb-6">
                    <div className="absolute -top-4 -left-2 h-4 w-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:-rotate-12 transition-all duration-700 delay-100">
                      <Sparkles className="h-full w-full" />
                    </div>
                    <div className="absolute bottom-2 -right-4 h-3 w-3 text-orange-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-125 transition-all duration-500 delay-200">
                      <Sparkles className="h-full w-full" />
                    </div>

                    <div className="relative z-10 h-16 w-16 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 ease-out cursor-pointer">
                      <PackageOpen
                        className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors duration-500"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-foreground mb-2 group-hover:text-primary transition-colors duration-500 whitespace-normal">
                    Belum ada varian 🐻
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-[320px] text-center leading-relaxed mb-6 whitespace-normal">
                    Apakah produk ini punya ukuran, rasa, atau warna yang
                    berbeda? Yuk, tambahkan varian!
                  </p>
                  <Button
                    onClick={handleCreate}
                    className="shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
                  >
                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                    <span className="relative flex items-center font-medium">
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Varian Pertama
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                  <Table className="w-full min-w-[700px]">
                    <TableHeader>
                      <TableRow className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20">
                        <TableHead className="font-medium text-foreground w-[15%]">
                          SKU
                        </TableHead>
                        <TableHead className="font-medium text-foreground w-[30%]">
                          Nama Varian
                        </TableHead>
                        <TableHead className="font-medium text-foreground w-[15%]">
                          Stok
                        </TableHead>
                        <TableHead className="font-medium text-foreground text-right w-[20%]">
                          Harga
                        </TableHead>
                        <TableHead className="font-medium text-foreground w-[10%]">
                          Status
                        </TableHead>
                        <TableHead className="w-[10%]">
                          <span className="sr-only">Aksi</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v) => (
                        <TableRow
                          key={v.id}
                          className="group border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200 cursor-default"
                        >
                          <TableCell className="text-xs font-mono text-muted-foreground/80 group-hover:text-foreground/80 transition-colors">
                            {v.sku || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-[15px]">
                            {v.name || 'Tanpa Nama'}
                          </TableCell>
                          <TableCell>
                            <span className="text-[15px]">
                              {v.stock}{' '}
                              <span className="text-muted-foreground/70 text-sm ml-0.5">
                                {v.unit || 'pcs'}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-[15px]">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              maximumFractionDigits: 0,
                            }).format(v.price || 0)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                v.isActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  v.isActive
                                    ? 'bg-primary'
                                    : 'bg-muted-foreground/40'
                                }`}
                              />
                              {v.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                onClick={() => handleEdit(v)}
                                title="Edit varian"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="sr-only">Edit varian</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => handleDeleteClick(v)}
                                title="Hapus varian"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Hapus varian</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Sheet */}
      <VariantFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingVariant(null)
        }}
        variant={editingVariant}
        onSubmit={handleSubmit}
        isPending={createVariant.isPending || updateVariant.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Hapus varian?</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Anda akan menghapus varian{' '}
              <span className="font-medium text-foreground">
                {deletingVariant?.name}
              </span>{' '}
              ({deletingVariant?.sku}). Varian ini akan dihapus dan tidak bisa
              dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteVariant.isPending}
            >
              Batalkan
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteVariant.isPending}
            >
              {deleteVariant.isPending ? 'Menghapus...' : 'Ya, Hapus Varian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit Sheet */}
      <ProductFormSheet
        open={productSheetOpen}
        onOpenChange={setProductSheetOpen}
        product={product}
        onSubmit={handleProductSubmit}
        isPending={updateProduct.isPending}
      />

      {/* Product Delete Confirmation Dialog */}
      <Dialog
        open={productDeleteDialogOpen}
        onOpenChange={setProductDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Hapus dari katalog?</DialogTitle>
            <DialogDescription className="text-base mt-2">
              Anda akan menghapus{' '}
              <span className="font-medium text-foreground">
                {product?.name}
              </span>
              . Produk ini akan hilang selamanya dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProductDeleteDialogOpen(false)}
              disabled={deleteProduct.isPending}
            >
              Batalkan
            </Button>
            <Button
              variant="destructive"
              onClick={handleProductDeleteConfirm}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? 'Menghapus...' : 'Ya, Hapus Produk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Product Form Sheet ──────────────────────────────────────

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSubmit: (values: {
    name: string
    slug: string
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
      slug: product?.slug ?? '',
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
      form.setFieldValue('slug', product?.slug ?? '')
      form.setFieldValue('description', product?.description ?? '')
      form.setFieldValue('isActive', product?.isActive ?? true)
      setServerError(null)
    }
  }, [open, product])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">Edit Info Produk</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            Pastikan detail produk selalu up-to-date agar pelanggan tidak
            bingung.
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

          {/* Slug */}
          <form.Field
            name="slug"
            validators={{
              onBlur: productSchema.shape.slug,
              onSubmit: productSchema.shape.slug,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="kopi-arabika-premium"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier. Hanya huruf kecil, angka, strip (-),
                  dan garis bawah (_).
                </p>
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
                <Textarea
                  id={field.name}
                  placeholder="Ceritakan sedikit tentang produk ini (opsional)..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                  className="resize-none"
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
                  className="flex-1 shadow-sm"
                  disabled={isSubmitting || isPending}
                  onClick={() => form.handleSubmit()}
                >
                  {isSubmitting || isPending
                    ? 'Menyimpan...'
                    : 'Simpan Perubahan'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Variant Form Sheet ──────────────────────────────────────

interface VariantFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: Variant | null
  onSubmit: (values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
  }) => Promise<void>
  isPending: boolean
}

function VariantFormSheet({
  open,
  onOpenChange,
  variant,
  onSubmit,
  isPending,
}: VariantFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      sku: variant?.sku ?? '',
      name: variant?.name ?? '',
      price: variant?.price ?? 0,
      unit: variant?.unit ?? '',
      isActive: variant?.isActive ?? true,
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

  // Reset form when variant changes
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('sku', variant?.sku ?? '')
      form.setFieldValue('name', variant?.name ?? '')
      form.setFieldValue('price', variant?.price ?? 0)
      form.setFieldValue('unit', variant?.unit ?? '')
      form.setFieldValue('isActive', variant?.isActive ?? true)
      setServerError(null)
    }
  }, [open, variant])

  const isEditing = !!variant

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">
            {isEditing ? 'Edit Varian' : 'Varian Baru'}
          </SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            {isEditing
              ? 'Perbarui detail varian agar informasi produk selalu akurat.'
              : 'Tambahkan varian baru untuk produk ini.'}
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

          {/* SKU */}
          <form.Field
            name="sku"
            validators={{
              onBlur: variantSchema.shape.sku,
              onSubmit: variantSchema.shape.sku,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: KOP-ARA-001"
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

          {/* Name */}
          <form.Field
            name="name"
            validators={{
              onBlur: variantSchema.shape.name,
              onSubmit: variantSchema.shape.name,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Varian <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: Ukuran 250g"
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

          {/* Price */}
          <form.Field
            name="price"
            validators={{
              onBlur: variantSchema.shape.price,
              onSubmit: variantSchema.shape.price,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Harga <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(parseFloat(e.target.value) || 0)
                  }
                />
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Unit */}
          <form.Field name="unit">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Satuan
                </Label>
                <Input
                  id={field.name}
                  placeholder="pcs"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
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
                  Varian aktif
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
                  className="flex-1 shadow-sm"
                  disabled={isSubmitting || isPending}
                  onClick={() => form.handleSubmit()}
                >
                  {isSubmitting || isPending
                    ? 'Menyimpan...'
                    : isEditing
                      ? 'Simpan Perubahan'
                      : 'Simpan Varian'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
