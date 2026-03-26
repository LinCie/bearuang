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
import { useAvailablePermissions } from '../hooks/use-roles'
import type { Role } from '../hooks/use-roles'
import { cn } from '@/lib/utils'
import { Check, Minus, Loader2 } from 'lucide-react'

// Local form type to avoid strict template literal types from backend
interface RoleFormData {
  role: string
  permissions: string[]
}

const roleFormSchema = z.object({
  role: z
    .string()
    .trim()
    .min(1, 'Nama peran wajib diisi')
    .max(50, 'Nama peran maksimal 50 karakter'),
  permissions: z.array(z.string()).min(1, 'Pilih minimal satu izin'),
})

// Resource labels in Indonesian
const resourceLabels: Record<string, string> = {
  product: 'Produk',
  productVariant: 'Varian Produk',
  warehouse: 'Gudang',
  supplier: 'Pemasok',
  customer: 'Pelanggan',
  purchaseOrder: 'Pesanan Pembelian',
  purchaseOrderItem: 'Item Pesanan Pembelian',
  salesOrder: 'Pesanan Penjualan',
  salesOrderItem: 'Item Pesanan Penjualan',
  stock: 'Stok',
  apiKey: 'Kunci API',
  invitation: 'Undangan',
  member: 'Anggota',
}

// Action labels in Indonesian
const actionLabels: Record<string, string> = {
  create: 'Buat',
  update: 'Ubah',
  delete: 'Hapus',
  read: 'Lihat',
  receive: 'Terima',
  fulfill: 'Penuhi',
  adjust: 'Sesuaikan',
  view: 'Lihat',
}

interface RoleFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: RoleFormData) => Promise<void>
  isPending: boolean
  editingRole?: Role | null
}

export function RoleFormSheet({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  editingRole,
}: RoleFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const { data: availablePermissions, isLoading: permissionsLoading } =
    useAvailablePermissions()

  const isEditing = !!editingRole

  const form = useForm({
    defaultValues: {
      role: editingRole?.role ?? '',
      permissions: editingRole?.permissions ?? [],
    } as RoleFormData,
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
      form.reset({
        role: editingRole?.role ?? '',
        permissions: editingRole?.permissions ?? [],
      })
      setServerError(null)
    }
  }, [open, editingRole])

  const resourceGroups = React.useMemo(() => {
    if (!availablePermissions) return []
    return availablePermissions.resources.map((resource) => ({
      resource,
      label: resourceLabels[resource] ?? resource,
      actions: (availablePermissions.actions[resource] ?? []).map((action) => ({
        action,
        label: actionLabels[action] ?? action,
        permission: `${resource}:${action}`,
      })),
    }))
  }, [availablePermissions])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">
            {isEditing ? 'Ubah Peran' : 'Buat Peran Baru'}
          </SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            {isEditing
              ? 'Ubah nama dan izin untuk peran kustom ini.'
              : 'Buat peran kustom dengan izin yang dapat disesuaikan.'}
          </SheetDescription>
        </SheetHead>

        <form
          className="flex flex-col gap-5 px-4 flex-1"
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

          {/* Role Name */}
          <form.Field
            name="role"
            validators={{
              onBlur: roleFormSchema.shape.role,
              onSubmit: roleFormSchema.shape.role,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama Peran <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  type="text"
                  placeholder="Contoh: Manajer Gudang"
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

          {/* Permissions */}
          <form.Field
            name="permissions"
            validators={{
              onSubmit: roleFormSchema.shape.permissions,
            }}
          >
            {(field) => {
              const selectedPermissions = field.state.value
              const allPermissions = availablePermissions?.permissions ?? []

              const togglePermission = (permission: string) => {
                const current = selectedPermissions
                if (current.includes(permission)) {
                  field.handleChange(current.filter((p) => p !== permission))
                } else {
                  field.handleChange([...current, permission])
                }
              }

              const toggleResource = (resource: string) => {
                const resourcePerms =
                  resourceGroups
                    .find((g) => g.resource === resource)
                    ?.actions.map((a) => a.permission) ?? []
                const allSelected = resourcePerms.every((p) =>
                  selectedPermissions.includes(p),
                )
                if (allSelected) {
                  field.handleChange(
                    selectedPermissions.filter(
                      (p) => !resourcePerms.includes(p),
                    ),
                  )
                } else {
                  const newPerms = new Set([
                    ...selectedPermissions,
                    ...resourcePerms,
                  ])
                  field.handleChange([...newPerms])
                }
              }

              const isResourceSelected = (resource: string) => {
                const resourcePerms =
                  resourceGroups
                    .find((g) => g.resource === resource)
                    ?.actions.map((a) => a.permission) ?? []
                return resourcePerms.every((p) =>
                  selectedPermissions.includes(p),
                )
              }

              const isResourceIndeterminate = (resource: string) => {
                const resourcePerms =
                  resourceGroups
                    .find((g) => g.resource === resource)
                    ?.actions.map((a) => a.permission) ?? []
                const selected = resourcePerms.filter((p) =>
                  selectedPermissions.includes(p),
                )
                return (
                  selected.length > 0 && selected.length < resourcePerms.length
                )
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">
                      Izin <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => field.handleChange(allPermissions)}
                      >
                        Pilih Semua
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => field.handleChange([])}
                      >
                        Hapus Semua
                      </Button>
                    </div>
                  </div>

                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive font-medium">
                      {field.state.meta.errors[0].message}
                    </p>
                  )}

                  {permissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                      {resourceGroups.map((group) => {
                        const isSelected = isResourceSelected(group.resource)
                        const isIndeterminate = isResourceIndeterminate(
                          group.resource,
                        )

                        return (
                          <div
                            key={group.resource}
                            className="border border-border/60 rounded-lg overflow-hidden"
                          >
                            {/* Resource header */}
                            <button
                              type="button"
                              onClick={() => toggleResource(group.resource)}
                              className={cn(
                                'flex items-center gap-3 w-full px-4 py-3 text-left transition-colors',
                                isSelected
                                  ? 'bg-primary/5'
                                  : 'hover:bg-muted/50',
                              )}
                            >
                              <div
                                className={cn(
                                  'flex items-center justify-center w-5 h-5 rounded border transition-colors',
                                  isSelected
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : isIndeterminate
                                      ? 'bg-primary/20 border-primary text-primary'
                                      : 'border-input',
                                )}
                              >
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : isIndeterminate ? (
                                  <Minus className="h-3.5 w-3.5" />
                                ) : null}
                              </div>
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  isSelected
                                    ? 'text-primary'
                                    : 'text-foreground',
                                )}
                              >
                                {group.label}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {
                                  group.actions.filter((a) =>
                                    selectedPermissions.includes(a.permission),
                                  ).length
                                }
                                /{group.actions.length}
                              </span>
                            </button>

                            {/* Action checkboxes */}
                            <div className="border-t border-border/40">
                              {group.actions.map((action) => {
                                const isActionSelected =
                                  selectedPermissions.includes(
                                    action.permission,
                                  )
                                return (
                                  <label
                                    key={action.permission}
                                    className={cn(
                                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                                      isActionSelected
                                        ? 'bg-primary/5'
                                        : 'hover:bg-muted/30',
                                    )}
                                  >
                                    <Checkbox
                                      checked={isActionSelected}
                                      onCheckedChange={() =>
                                        togglePermission(action.permission)
                                      }
                                    />
                                    <span className="text-sm text-foreground">
                                      {action.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                                      {action.permission}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {selectedPermissions.length} izin dipilih
                  </p>
                </div>
              )
            }}
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
                      : 'Buat Peran'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
