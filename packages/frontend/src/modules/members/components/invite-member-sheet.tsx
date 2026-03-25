import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  role: z.enum(['member', 'admin', 'owner']),
})

interface InviteMemberSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    email: string
    role: 'member' | 'admin' | 'owner'
  }) => Promise<void>
  isPending: boolean
}

const roleOptions = [
  {
    value: 'member' as const,
    label: 'Anggota',
    description: 'Akses dasar ke data organisasi',
  },
  {
    value: 'admin' as const,
    label: 'Admin',
    description: 'Akses penuh kecuali pengaturan organisasi',
  },
  {
    value: 'owner' as const,
    label: 'Pemilik',
    description: 'Akses penuh termasuk pengaturan organisasi',
  },
]

export function InviteMemberSheet({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: InviteMemberSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      role: 'member' as 'member' | 'admin' | 'owner',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await onSubmit(value)
        form.reset()
      } catch (err) {
        const error = err as { message?: string }
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset()
      setServerError(null)
    }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">Undang Anggota</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            Kirim undangan untuk bergabung dengan organisasi Anda.
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

          {/* Email */}
          <form.Field
            name="email"
            validators={{
              onBlur: inviteSchema.shape.email,
              onSubmit: inviteSchema.shape.email,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  type="email"
                  placeholder="rekan@example.com"
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

          {/* Role */}
          <form.Field name="role">
            {(field) => (
              <div className="space-y-1.5">
                <Label className="font-medium">Peran</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as 'member' | 'admin' | 'owner')
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {
                    roleOptions.find((r) => r.value === field.state.value)
                      ?.description
                  }
                </p>
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
                  {isSubmitting || isPending ? 'Mengirim...' : 'Kirim Undangan'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
