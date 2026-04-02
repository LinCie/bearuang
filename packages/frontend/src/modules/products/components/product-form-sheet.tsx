import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Textarea } from '#components/ui/textarea'
import { Label } from '#components/ui/label'
import { Checkbox } from '#components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '#components/ui/sheet'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '#components/ui/combobox'
import { useProductCategories } from '#modules/product-categories/hooks/use-product-categories'
import { MultiFileUpload } from '#modules/uploads/components/multi-file-upload'
import type { PendingImage } from '#modules/uploads/components/multi-file-upload'
import type { Media } from 'backend/src/modules/uploads/uploads.route'
import type {
  Product,
  ProductImage,
} from 'backend/src/modules/products/products.route'

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
  categoryId: z.string().nullable(),
  isActive: z.boolean(),
})

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSubmit: (values: {
    name: string
    slug: string
    description: string
    categoryId: string | null
    isActive: boolean
    pendingImages: Media[]
    removedImageIds: string[]
    reorderedImageIds?: string[]
  }) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSubmit,
  isPending,
  mode = 'edit',
}: ProductFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [existingImages, setExistingImages] = React.useState<ProductImage[]>([])
  const [removedImageIds, setRemovedImageIds] = React.useState<string[]>([])
  const [reorderedImageIds, setReorderedImageIds] = React.useState<string[]>([])
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([])

  const { data: categoriesData } = useProductCategories({ pageSize: 100 })
  const allCategories = categoriesData?.data ?? []

  const [categoryOpen, setCategoryOpen] = React.useState(false)
  const [categoryQuery, setCategoryQuery] = React.useState('')

  const filteredCategories = React.useMemo(() => {
    if (!categoryQuery) return allCategories
    const q = categoryQuery.toLowerCase()
    return allCategories.filter((c) => c.name.toLowerCase().includes(q))
  }, [allCategories, categoryQuery])

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const isEditing = mode === 'edit' && !!product

  const form = useForm({
    defaultValues: {
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? null,
      isActive: product?.isActive ?? true,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const doneImages = pendingImages
          .filter((p) => p.status === 'done' && p.media)
          .map((p) => p.media as Media)
        await onSubmit({
          ...value,
          pendingImages: doneImages,
          removedImageIds,
          reorderedImageIds,
        })
      } catch (err) {
        const error = err as { message?: string }
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    },
  })

  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', product?.name ?? '')
      form.setFieldValue('slug', product?.slug ?? '')
      form.setFieldValue('description', product?.description ?? '')
      form.setFieldValue('categoryId', product?.categoryId ?? null)
      form.setFieldValue('isActive', product?.isActive ?? true)
      setCategoryQuery('')
      setCategoryOpen(false)
      setExistingImages(product?.images ?? [])
      setRemovedImageIds([])
      setPendingImages([])
      setServerError(null)
    }
  }, [open, product])

  const title = isEditing ? 'Edit Info Produk' : 'Produk Baru'
  const description = isEditing
    ? 'Pastikan detail produk selalu up-to-date agar pelanggan tidak bingung.'
    : 'Tambahkan barang atau layanan baru agar pelanggan bisa mulai memesannya.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Simpan ke Katalog'

  const handleRemoveExisting = React.useCallback((imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId))
    setRemovedImageIds((prev) => [...prev, imageId])
  }, [])

  const hasAnyUploading = pendingImages.some((p) => p.status === 'uploading')
  const hasAnyError = pendingImages.some((p) => p.status === 'error')

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">{title}</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            {description}
          </SheetDescription>
        </SheetHead>

        <form
          className="flex flex-col gap-4 px-4 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (hasAnyUploading) return
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
                  onChange={(e) => {
                    const value = e.target.value
                    field.handleChange(value)
                    if (!isEditing) {
                      form.setFieldValue('slug', generateSlug(value))
                    }
                  }}
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

          {/* Category */}
          <form.Field name="categoryId">
            {(field) => {
              const selectedCategory =
                field.state.value && field.state.value !== ''
                  ? (allCategories.find((c) => c.id === field.state.value) ??
                    null)
                  : null
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="product-category" className="font-medium">
                    Kategori
                  </Label>
                  <Combobox
                    open={categoryOpen}
                    onOpenChange={setCategoryOpen}
                    value={selectedCategory ? selectedCategory.id : null}
                    onValueChange={(value) => {
                      field.handleChange((value as string) || null)
                      setCategoryOpen(false)
                      setCategoryQuery('')
                    }}
                  >
                    <ComboboxInput
                      placeholder={
                        selectedCategory
                          ? selectedCategory.name
                          : 'Cari dan pilih kategori...'
                      }
                      value={categoryQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setCategoryQuery(e.target.value)
                        setCategoryOpen(true)
                      }}
                      onFocus={() => setCategoryOpen(true)}
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        <ComboboxEmpty>
                          {allCategories.length === 0
                            ? 'Tidak ada kategori tersedia'
                            : 'Tidak ada kategori ditemukan'}
                        </ComboboxEmpty>
                        {selectedCategory && (
                          <ComboboxItem value="">
                            <span className="flex-1 text-muted-foreground">
                              Hapus kategori
                            </span>
                          </ComboboxItem>
                        )}
                        {filteredCategories.map((c) => (
                          <ComboboxItem key={c.id} value={c.id}>
                            <span className="flex-1">{c.name}</span>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <p className="text-xs text-muted-foreground">
                    Opsional. Untuk mengelompokkan produk yang serupa.
                  </p>
                </div>
              )
            }}
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

          <MultiFileUpload
            existingImages={existingImages.map((img) => ({
              id: img.id,
              url: img.media.url,
              altText: img.altText,
            }))}
            onRemoveExisting={handleRemoveExisting}
            onReorderExisting={setReorderedImageIds}
            pendingImages={pendingImages}
            onSetPendingImages={setPendingImages}
            purpose="product-image"
            label="Foto Produk"
          />
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
                  disabled={
                    isSubmitting || isPending || hasAnyUploading || hasAnyError
                  }
                  onClick={() => form.handleSubmit()}
                >
                  {isSubmitting || isPending ? 'Menyimpan...' : submitLabel}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
