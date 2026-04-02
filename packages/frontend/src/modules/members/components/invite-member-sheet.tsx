import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '#components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { useRoles } from '#modules/roles/index'

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  role: z.string().min(1, 'Peran wajib dipilih'),
})

interface InviteMemberSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { email: string; role: string }) => Promise<void>
  isPending: boolean
}

interface RoleOption {
  value: string
  label: string
  description: string
}

const systemRoleOptions: RoleOption[] = [
  {
    value: 'member',
    label: 'Anggota',
    description: 'Akses dasar ke data organisasi',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Akses penuh kecuali pengaturan organisasi',
  },
  {
    value: 'owner',
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
  const { data: customRoles } = useRoles()

  const form = useForm({
    defaultValues: {
      email: '',
      role: 'member',
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

  // Combine system roles with custom roles
  const allRoleOptions = React.useMemo(() => {
    const options = [...systemRoleOptions]
    if (customRoles) {
      for (const role of customRoles) {
        options.push({
          value: role.role,
          label: role.role,
          description: `${role.permissions.length} izin kustom`,
        })
      }
    }
    return options
  }, [customRoles])

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
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoleOptions.map((option) => (
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
                    allRoleOptions.find((r) => r.value === field.state.value)
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
