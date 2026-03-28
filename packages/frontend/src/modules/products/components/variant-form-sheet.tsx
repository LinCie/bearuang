import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { MultiFileUpload } from '@/modules/uploads/components/multi-file-upload'
import type { PendingImage } from '@/modules/uploads/components/multi-file-upload'
import type { Media } from 'backend/src/modules/uploads/uploads.route'
import type {
  ProductVariant,
  VariantImage,
} from 'backend/src/modules/products/products.route'

const variantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU wajib diisi'),
  name: z.string().trim().min(1, 'Nama varian wajib diisi'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  unit: z.string().trim().optional(),
  isActive: z.boolean(),
})

interface VariantFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: ProductVariant | null
  onSubmit: (values: {
    sku: string
    name: string
    price: number
    unit?: string
    isActive: boolean
    pendingImages: Media[]
    removedImageIds: string[]
  }) => Promise<void>
  isPending: boolean
}

export function VariantFormSheet({
  open,
  onOpenChange,
  variant,
  onSubmit,
  isPending,
}: VariantFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [existingImages, setExistingImages] = React.useState<VariantImage[]>([])
  const [removedImageIds, setRemovedImageIds] = React.useState<string[]>([])
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([])

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
        const doneImages = pendingImages
          .filter((p) => p.status === 'done' && p.media)
          .map((p) => p.media as Media)
        await onSubmit({
          ...value,
          pendingImages: doneImages,
          removedImageIds,
        })
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
      setExistingImages(variant?.images ?? [])
      setRemovedImageIds([])
      setPendingImages([])
      setServerError(null)
    }
  }, [open, variant])

  const isEditing = !!variant

  const handleRemoveExisting = React.useCallback((imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId))
    setRemovedImageIds((prev) => [...prev, imageId])
  }, [])

  const hasAnyUploading = pendingImages.some((p) => p.status === 'uploading')
  const hasAnyError = pendingImages.some((p) => p.status === 'error')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
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
          <MultiFileUpload
            existingImages={existingImages.map((img) => ({
              id: img.id,
              url: img.media.url,
              altText: img.altText,
            }))}
            onRemoveExisting={handleRemoveExisting}
            pendingImages={pendingImages}
            onSetPendingImages={setPendingImages}
            purpose="variant-image"
            label="Foto Varian"
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
