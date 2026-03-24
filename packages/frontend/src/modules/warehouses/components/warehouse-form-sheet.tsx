import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import type { Warehouse } from 'backend/src/modules/warehouses/warehouses.route'

const warehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama gudang wajib diisi')
    .max(100, 'Nama gudang maksimal 100 karakter'),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat maksimal 500 karakter')
    .optional(),
  isActive: z.boolean(),
})

interface WarehouseFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: Warehouse | null
  onSubmit: (values: {
    name: string
    address: string
    isActive: boolean
  }) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

export function WarehouseFormSheet({
  open,
  onOpenChange,
  warehouse,
  onSubmit,
  isPending,
  mode = 'edit',
}: WarehouseFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const isEditing = mode === 'edit' && !!warehouse

  const form = useForm({
    defaultValues: {
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
      isActive: warehouse?.isActive ?? true,
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

  // Reset form when warehouse changes
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', warehouse?.name ?? '')
      form.setFieldValue('address', warehouse?.address ?? '')
      form.setFieldValue('isActive', warehouse?.isActive ?? true)
      setServerError(null)
    }
  }, [open, warehouse])

  const title = isEditing ? 'Edit Gudang' : 'Gudang Baru'
  const description = isEditing
    ? 'Perbarui informasi gudang untuk memastikan data lokasi penyimpanan tetap akurat.'
    : 'Tambahkan lokasi penyimpanan baru untuk mengatur stok barang Anda.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Tambah Gudang'

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
              onBlur: warehouseSchema.shape.name,
              onSubmit: warehouseSchema.shape.name,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Gudang <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: Gudang Utama Jakarta"
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

          {/* Address */}
          <form.Field name="address">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Alamat
                </Label>
                <Textarea
                  id={field.name}
                  placeholder="Masukkan alamat lengkap gudang (opsional)..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Alamat lengkap membantu tim logistik menemukan lokasi gudang.
                </p>
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
                  Gudang aktif
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
