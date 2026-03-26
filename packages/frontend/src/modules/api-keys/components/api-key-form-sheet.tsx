import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetHead,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useAvailablePermissions } from '@/modules/roles'
import type { ApiKey } from '../hooks/use-api-keys'
import { cn } from '@/lib/utils'
import { Check, Minus, Loader2 } from 'lucide-react'

const EXPIRY_OPTIONS = [
  { value: '0', label: 'Tidak ada batas' },
  { value: '86400000', label: '1 hari' },
  { value: '604800000', label: '7 hari' },
  { value: '2592000000', label: '30 hari' },
  { value: '7776000000', label: '90 hari' },
  { value: '31536000000', label: '1 tahun' },
]

const RATE_LIMIT_WINDOW_OPTIONS = [
  { value: '60000', label: '1 menit' },
  { value: '3600000', label: '1 jam' },
  { value: '86400000', label: '1 hari' },
]

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

function permissionsToRecord(permissions: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const perm of permissions) {
    const [resource, action] = perm.split(':')
    if (!resource || !action) continue
    if (!(resource in result)) result[resource] = []
    result[resource].push(action)
  }
  return result
}

function recordToPermissions(
  record: Record<string, string[]> | null,
): string[] {
  if (!record) return []
  const result: string[] = []
  for (const [resource, actions] of Object.entries(record)) {
    for (const action of actions) {
      result.push(`${resource}:${action}`)
    }
  }
  return result
}

interface ApiKeyFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKey | null
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

export function ApiKeyFormSheet({
  open,
  onOpenChange,
  apiKey,
  onSubmit,
  isPending,
  mode = 'create',
}: ApiKeyFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const isEditing = mode === 'edit' && !!apiKey
  const { data: availablePermissions, isLoading: permissionsLoading } =
    useAvailablePermissions()

  const form = useForm({
    defaultValues: {
      name: apiKey?.name ?? '',
      expiresIn: '0',
      permissions: recordToPermissions(apiKey?.permissions ?? null),
      rateLimitMax: apiKey?.rateLimitMax?.toString() ?? '',
      rateLimitTimeWindow: apiKey?.rateLimitTimeWindow?.toString() ?? '3600000',
      enabled: apiKey?.enabled ?? true,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const payload: Record<string, unknown> = {
          name: value.name,
        }

        if (!isEditing) {
          const ms = Number(value.expiresIn)
          if (ms > 0) payload.expiresIn = ms
        }

        if (value.permissions.length > 0) {
          payload.permissions = permissionsToRecord(value.permissions)
        } else if (isEditing) {
          payload.permissions = null
        }

        if (value.rateLimitMax) {
          payload.rateLimitMax = Number(value.rateLimitMax)
        }
        if (value.rateLimitTimeWindow) {
          payload.rateLimitTimeWindow = Number(value.rateLimitTimeWindow)
        }

        if (isEditing) {
          payload.enabled = value.enabled
        }

        await onSubmit(payload)
      } catch (err) {
        const error = err as { message?: string }
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    },
  })

  React.useEffect(() => {
    if (open) {
      form.setFieldValue('name', apiKey?.name ?? '')
      form.setFieldValue(
        'permissions',
        recordToPermissions(apiKey?.permissions ?? null),
      )
      form.setFieldValue('rateLimitMax', apiKey?.rateLimitMax?.toString() ?? '')
      form.setFieldValue(
        'rateLimitTimeWindow',
        apiKey?.rateLimitTimeWindow?.toString() ?? '3600000',
      )
      form.setFieldValue('enabled', apiKey?.enabled ?? true)
      form.setFieldValue('expiresIn', '0')
      setServerError(null)
    }
  }, [open, apiKey])

  const title = isEditing ? 'Edit API Key' : 'API Key Baru'
  const description = isEditing
    ? 'Perbarui pengaturan API key seperti nama, izin, dan batas rate.'
    : 'Buat API key baru untuk mengakses API BearUang secara terprogram.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Buat API Key'

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
          <SheetTitle className="text-2xl">{title}</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            {description}
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
              onBlur: z
                .string()
                .trim()
                .min(1, 'Nama API key wajib diisi')
                .max(64, 'Nama API key maksimal 64 karakter'),
              onSubmit: z
                .string()
                .trim()
                .min(1, 'Nama API key wajib diisi')
                .max(64, 'Nama API key maksimal 64 karakter'),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Nama API Key <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  placeholder="Contoh: Production API"
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

          {/* Expiration (create only) */}
          {!isEditing && (
            <form.Field name="expiresIn">
              {(field) => (
                <div className="space-y-1.5">
                  <Label className="font-medium">Masa Berlaku</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih masa berlaku" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Setelah masa berlaku habis, API key akan otomatis tidak
                    aktif.
                  </p>
                </div>
              )}
            </form.Field>
          )}

          {/* Permissions */}
          <form.Field name="permissions">
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
                    <Label className="font-medium">Izin</Label>
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

                  <p className="text-xs text-muted-foreground">
                    Kosongkan semua izin untuk memberikan akses penuh.
                  </p>

                  {permissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
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

                  {selectedPermissions.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedPermissions.length} izin dipilih
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {/* Rate Limit */}
          <div className="space-y-3">
            <Label className="font-medium">Batas Permintaan (Rate Limit)</Label>
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="rateLimitMax">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={field.name}
                      className="text-xs text-muted-foreground"
                    >
                      Maks. Permintaan
                    </Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      placeholder="1000"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="rateLimitTimeWindow">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Per Waktu
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih jendela waktu" />
                      </SelectTrigger>
                      <SelectContent>
                        {RATE_LIMIT_WINDOW_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Batasi jumlah permintaan yang dapat dilakukan dengan API key ini.
              Kosongkan untuk tidak ada batas.
            </p>
          </div>

          {/* Enabled (edit only) */}
          {isEditing && (
            <form.Field name="enabled">
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
                    API key aktif
                  </Label>
                </div>
              )}
            </form.Field>
          )}
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
