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
import type { Supplier } from 'backend/src/modules/suppliers/suppliers.route'

const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama pemasok wajib diisi')
    .max(100, 'Nama pemasok maksimal 100 karakter'),
  email: z.union([z.string().email('Format email tidak valid'), z.literal('')]),
  phone: z.string().max(20, 'Nomor telepon maksimal 20 karakter'),
  address: z.string().max(500, 'Alamat maksimal 500 karakter'),
  isActive: z.boolean(),
})

interface SupplierFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  onSubmit: (values: {
    name: string
    email: string
    phone: string
    address: string
    isActive: boolean
  }) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

export function SupplierFormSheet({
  open,
  onOpenChange,
  supplier,
  onSubmit,
  isPending,
  mode = 'edit',
}: SupplierFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const isEditing = mode === 'edit' && !!supplier

  const form = useForm({
    defaultValues: {
      name: supplier?.name ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      isActive: supplier?.isActive ?? true,
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

  // Reset form when supplier changes
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', supplier?.name ?? '')
      form.setFieldValue('email', supplier?.email ?? '')
      form.setFieldValue('phone', supplier?.phone ?? '')
      form.setFieldValue('address', supplier?.address ?? '')
      form.setFieldValue('isActive', supplier?.isActive ?? true)
      setServerError(null)
    }
  }, [open, supplier])

  const title = isEditing ? 'Edit Pemasok' : 'Pemasok Baru'
  const description = isEditing
    ? 'Perbarui informasi pemasok untuk memastikan data vendor tetap akurat.'
    : 'Tambahkan pemasok baru untuk mengelola hubungan bisnis dengan vendor Anda.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Tambah Pemasok'

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
              onBlur: supplierSchema.shape.name,
              onSubmit: supplierSchema.shape.name,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Pemasok <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: PT Supplier Sejahtera"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive font-medium">
                    {String(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Email */}
          <form.Field
            name="email"
            validators={{
              onBlur: supplierSchema.shape.email,
              onSubmit: supplierSchema.shape.email,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Email
                </Label>
                <Input
                  id={field.name}
                  type="email"
                  placeholder="supplier@contoh.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive font-medium">
                    {String(field.state.meta.errors[0])}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Phone */}
          <form.Field
            name="phone"
            validators={{
              onBlur: supplierSchema.shape.phone,
              onSubmit: supplierSchema.shape.phone,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Telepon
                </Label>
                <Input
                  id={field.name}
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive font-medium">
                    {String(field.state.meta.errors[0])}
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
                  placeholder="Masukkan alamat lengkap pemasok (opsional)..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Alamat membantu dalam pengiriman dan dokumentasi.
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
                  Pemasok aktif
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
