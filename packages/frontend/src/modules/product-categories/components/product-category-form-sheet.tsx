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
import type { ProductCategory } from 'backend/src/modules/product-categories/product-categories.route'

const slugRegex = /^[a-z0-9_-]+$/

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi')
    .max(100, 'Nama kategori maksimal 100 karakter'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug wajib diisi')
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
  parentId: z.string().nullable(),
})

interface ProductCategoryFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: ProductCategory | null
  onSubmit: (values: {
    name: string
    slug: string
    description: string
    isActive: boolean
    parentId: string | null
  }) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

function getDescendantIds(
  categoryId: string,
  categories: readonly ProductCategory[],
): Set<string> {
  const childrenMap = new Map<string, string[]>()
  for (const cat of categories) {
    if (cat.parentId) {
      const existing = childrenMap.get(cat.parentId) ?? []
      existing.push(cat.id)
      childrenMap.set(cat.parentId, existing)
    }
  }

  const result = new Set<string>()
  function collect(id: string): void {
    const children = childrenMap.get(id)
    if (children) {
      for (const childId of children) {
        result.add(childId)
        collect(childId)
      }
    }
  }
  collect(categoryId)
  return result
}

export function ProductCategoryFormSheet({
  open,
  onOpenChange,
  category,
  onSubmit,
  isPending,
  mode = 'edit',
}: ProductCategoryFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const isEditing = mode === 'edit' && !!category

  const { data: categoriesData } = useProductCategories({ pageSize: 100 })
  const allCategories = categoriesData?.data ?? []

  const excludedIds = React.useMemo(() => {
    if (!isEditing) return new Set<string>()
    const ids = getDescendantIds(category.id, allCategories)
    ids.add(category.id)
    return ids
  }, [isEditing, category, allCategories])

  const [parentOpen, setParentOpen] = React.useState(false)
  const [parentQuery, setParentQuery] = React.useState('')

  const eligibleCategories = React.useMemo(
    () => allCategories.filter((c) => !excludedIds.has(c.id)),
    [allCategories, excludedIds],
  )

  const filteredCategories = React.useMemo(() => {
    if (!parentQuery) return eligibleCategories
    const q = parentQuery.toLowerCase()
    return eligibleCategories.filter((c) => c.name.toLowerCase().includes(q))
  }, [eligibleCategories, parentQuery])

  const form = useForm({
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      isActive: category?.isActive ?? true,
      parentId: category?.parentId ?? null,
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

  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', category?.name ?? '')
      form.setFieldValue('slug', category?.slug ?? '')
      form.setFieldValue('description', category?.description ?? '')
      form.setFieldValue('isActive', category?.isActive ?? true)
      form.setFieldValue('parentId', category?.parentId ?? null)
      setParentQuery('')
      setParentOpen(false)
      setServerError(null)
    }
  }, [open, category])

  const title = isEditing ? 'Edit Kategori' : 'Kategori Baru'
  const description = isEditing
    ? 'Perbarui informasi kategori produk.'
    : 'Tambahkan kategori baru untuk mengatur produk Anda.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Tambah Kategori'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
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
            form.handleSubmit()
          }}
        >
          {serverError && (
            <p
              role="alert"
              className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 font-medium"
            >
              {serverError}
            </p>
          )}

          {/* Name */}
          <form.Field
            name="name"
            validators={{
              onBlur: categorySchema.shape.name,
              onSubmit: categorySchema.shape.name,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Kategori <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: Makanan Ringan"
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
              onBlur: categorySchema.shape.slug,
              onSubmit: categorySchema.shape.slug,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: makanan-ringan"
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
                <Textarea
                  id={field.name}
                  placeholder="Masukkan deskripsi kategori (opsional)..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}
          </form.Field>

          {/* Parent Category Combobox */}
          <form.Field name="parentId">
            {(field) => {
              const currentParent =
                field.state.value && field.state.value !== ''
                  ? (allCategories.find((c) => c.id === field.state.value) ??
                    null)
                  : null
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="parent-category" className="font-medium">
                    Kategori Induk
                  </Label>
                  <Combobox
                    open={parentOpen}
                    onOpenChange={setParentOpen}
                    value={currentParent ? currentParent.id : null}
                    onValueChange={(value) => {
                      field.handleChange((value as string) || null)
                      setParentOpen(false)
                      setParentQuery('')
                    }}
                  >
                    <ComboboxInput
                      placeholder={
                        currentParent
                          ? currentParent.name
                          : 'Cari dan pilih kategori induk...'
                      }
                      value={parentQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setParentQuery(e.target.value)
                        setParentOpen(true)
                      }}
                      onFocus={() => setParentOpen(true)}
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        <ComboboxEmpty>
                          {eligibleCategories.length === 0
                            ? 'Tidak ada kategori tersedia'
                            : 'Tidak ada kategori ditemukan'}
                        </ComboboxEmpty>
                        {currentParent && (
                          <ComboboxItem value="">
                            <span className="flex-1 text-muted-foreground">
                              Hapus kategori induk
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
                    Opsional. Biarkan kosong untuk menjadikan kategori root.
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
                  Kategori aktif
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
