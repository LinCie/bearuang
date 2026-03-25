import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Plus, X, Check, Package } from 'lucide-react'
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
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { useSuppliers } from '@/modules/suppliers'
import { useWarehouses } from '@/modules/warehouses'
import { useVariants } from '@/modules/products'
import type { PurchaseOrder } from '@/modules/purchase-orders'
import type { Variant } from 'backend/src/modules/variants/variants.route'

const purchaseOrderItemSchema = z.object({
  variantId: z.string().min(1, 'Produk wajib dipilih'),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
  unitCost: z.number().nonnegative('Harga satuan tidak boleh negatif'),
})

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Pemasok wajib dipilih'),
  warehouseId: z.string().min(1, 'Gudang wajib dipilih'),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'Minimal 1 item wajib ditambahkan'),
})

interface PurchaseOrderFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder | null
  onSubmit: (values: {
    supplierId: string
    warehouseId: string
    items: Array<{ variantId: string; quantity: number; unitCost: number }>
  }) => Promise<void>
  isPending: boolean
  mode?: 'create' | 'edit'
}

interface VariantComboboxProps {
  value: string
  onChange: (value: string) => void
  variants: Variant[]
  selectedVariant: Variant | undefined
}

function VariantCombobox({
  value,
  onChange,
  variants,
  selectedVariant,
}: VariantComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const filteredVariants = React.useMemo(() => {
    if (!query) return variants
    const q = query.toLowerCase()
    return variants.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q),
    )
  }, [variants, query])

  return (
    <Combobox
      open={open}
      onOpenChange={setOpen}
      value={value || null}
      onValueChange={(v) => {
        onChange((v as string) || '')
        setOpen(false)
      }}
      disabled={variants.length === 0}
    >
      <ComboboxInput
        placeholder={
          selectedVariant
            ? `${selectedVariant.name} (${selectedVariant.sku})`
            : 'Cari dan pilih produk...'
        }
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setQuery(e.target.value)
        }
        disabled={variants.length === 0}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>
            {variants.length === 0
              ? 'Tidak ada produk tersedia'
              : 'Tidak ada produk ditemukan'}
          </ComboboxEmpty>
          {filteredVariants.map((v) => (
            <ComboboxItem key={v.id} value={v.id}>
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="font-medium">{v.name}</span>
                <span className="text-xs text-muted-foreground">
                  SKU: {v.sku}
                </span>
              </div>
              {value === v.id && <Check className="h-4 w-4 text-primary" />}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function PurchaseOrderFormSheet({
  open,
  onOpenChange,
  order,
  onSubmit,
  isPending,
  mode = 'create',
}: PurchaseOrderFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const isEditing = mode === 'edit' && !!order

  const { data: suppliersData } = useSuppliers({ pageSize: 100 })
  const { data: warehousesData } = useWarehouses({ pageSize: 100 })
  const { data: variantsData } = useVariants({ pageSize: 100 })

  const suppliers = suppliersData?.data ?? []
  const warehouses = warehousesData?.data ?? []
  const variants = variantsData?.data ?? []

  const form = useForm({
    defaultValues: {
      supplierId: order?.supplierId ?? '',
      warehouseId: order?.warehouseId ?? '',
      items: [] as Array<{
        variantId: string
        quantity: number
        unitCost: number
      }>,
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

  // Reset form when order changes
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('supplierId', order?.supplierId ?? '')
      form.setFieldValue('warehouseId', order?.warehouseId ?? '')
      form.setFieldValue('items', [])
      setServerError(null)
    }
  }, [open, order, form])

  const title = isEditing ? 'Edit Pesanan' : 'Pesanan Baru'
  const description = isEditing
    ? 'Ubah pemasok atau gudang untuk pesanan ini.'
    : 'Buat pesanan pembelian baru. Pilih produk dan tentukan jumlah yang dipesan.'
  const submitLabel = isEditing ? 'Simpan Perubahan' : 'Buat Pesanan'

  // Supplier combobox state
  const [supplierOpen, setSupplierOpen] = React.useState(false)
  const [supplierQuery, setSupplierQuery] = React.useState('')
  const selectedSupplier = suppliers.find(
    (s) => s.id === form.getFieldValue('supplierId'),
  )
  const filteredSuppliers = React.useMemo(() => {
    if (!supplierQuery) return suppliers
    const q = supplierQuery.toLowerCase()
    return suppliers.filter((s) => s.name.toLowerCase().includes(q))
  }, [suppliers, supplierQuery])

  // Warehouse combobox state
  const [warehouseOpen, setWarehouseOpen] = React.useState(false)
  const [warehouseQuery, setWarehouseQuery] = React.useState('')
  const selectedWarehouse = warehouses.find(
    (w) => w.id === form.getFieldValue('warehouseId'),
  )
  const filteredWarehouses = React.useMemo(() => {
    if (!warehouseQuery) return warehouses
    const q = warehouseQuery.toLowerCase()
    return warehouses.filter((w) => w.name.toLowerCase().includes(q))
  }, [warehouses, warehouseQuery])

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">{title}</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            {description}
          </SheetDescription>
        </SheetHead>

        <form
          className="flex flex-col gap-6 px-4 flex-1"
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

          {/* Supplier Combobox */}
          <form.Field
            name="supplierId"
            validators={{
              onBlur: createPurchaseOrderSchema.shape.supplierId,
              onSubmit: createPurchaseOrderSchema.shape.supplierId,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Pemasok <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  open={supplierOpen}
                  onOpenChange={setSupplierOpen}
                  value={field.state.value || null}
                  onValueChange={(value) => {
                    field.handleChange((value as string) || '')
                    setSupplierOpen(false)
                  }}
                >
                  <ComboboxInput
                    placeholder={
                      selectedSupplier
                        ? selectedSupplier.name
                        : 'Cari dan pilih pemasok...'
                    }
                    value={supplierQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSupplierQuery(e.target.value)
                    }
                    disabled={suppliers.length === 0}
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty>
                        {suppliers.length === 0
                          ? 'Tidak ada pemasok tersedia'
                          : 'Tidak ada pemasok ditemukan'}
                      </ComboboxEmpty>
                      {filteredSuppliers.map((s) => (
                        <ComboboxItem key={s.id} value={s.id}>
                          <span className="flex-1">{s.name}</span>
                          {field.state.value === s.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Warehouse Combobox */}
          <form.Field
            name="warehouseId"
            validators={{
              onBlur: createPurchaseOrderSchema.shape.warehouseId,
              onSubmit: createPurchaseOrderSchema.shape.warehouseId,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Gudang <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  open={warehouseOpen}
                  onOpenChange={setWarehouseOpen}
                  value={field.state.value || null}
                  onValueChange={(value) => {
                    field.handleChange((value as string) || '')
                    setWarehouseOpen(false)
                  }}
                >
                  <ComboboxInput
                    placeholder={
                      selectedWarehouse
                        ? selectedWarehouse.name
                        : 'Cari dan pilih gudang...'
                    }
                    value={warehouseQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setWarehouseQuery(e.target.value)
                    }
                    disabled={warehouses.length === 0}
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty>
                        {warehouses.length === 0
                          ? 'Tidak ada gudang tersedia'
                          : 'Tidak ada gudang ditemukan'}
                      </ComboboxEmpty>
                      {filteredWarehouses.map((w) => (
                        <ComboboxItem key={w.id} value={w.id}>
                          <span className="flex-1">{w.name}</span>
                          {field.state.value === w.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">
                Item Pesanan <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  form.pushFieldValue('items', {
                    variantId: '',
                    quantity: 1,
                    unitCost: 0,
                  })
                }}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah Item
              </Button>
            </div>

            <form.Field
              name="items"
              validators={{
                onSubmit: createPurchaseOrderSchema.shape.items,
              }}
            >
              {(field) => {
                const items = field.state.value
                const itemErrors = field.state.meta.errors

                return (
                  <div className="space-y-3">
                    {items.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                        <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Belum ada item. Klik &quot;Tambah Item&quot; untuk
                          menambahkan produk.
                        </p>
                      </div>
                    )}

                    {items.map((item, index) => {
                      const selectedVariant = variants.find(
                        (v) => v.id === item.variantId,
                      )
                      return (
                        <div
                          key={index}
                          className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30"
                        >
                          <div className="flex-1 space-y-2">
                            {/* Variant Combobox */}
                            <VariantCombobox
                              value={item.variantId}
                              onChange={(value) => {
                                const newItems = [...items]
                                newItems[index] = {
                                  ...item,
                                  variantId: value,
                                }
                                field.handleChange(newItems)
                              }}
                              variants={variants}
                              selectedVariant={selectedVariant}
                            />

                            <div className="flex gap-2">
                              {/* Quantity Input */}
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  Jumlah
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) => {
                                    const newItems = [...items]
                                    newItems[index] = {
                                      ...item,
                                      quantity: parseInt(e.target.value) || 1,
                                    }
                                    field.handleChange(newItems)
                                  }}
                                  className="h-8"
                                />
                              </div>

                              {/* Unit Cost Input */}
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  Harga Satuan (Rp)
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.unitCost}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) => {
                                    const newItems = [...items]
                                    newItems[index] = {
                                      ...item,
                                      unitCost: parseFloat(e.target.value) || 0,
                                    }
                                    field.handleChange(newItems)
                                  }}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newItems = items.filter(
                                (_, i) => i !== index,
                              )
                              field.handleChange(newItems)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}

                    {itemErrors[0] && (
                      <p className="text-xs text-destructive font-medium">
                        {itemErrors[0].message}
                      </p>
                    )}
                  </div>
                )
              }}
            </form.Field>
          </div>

          {/* Total Summary */}
          <form.Subscribe selector={(state) => state.values.items}>
            {(items) => {
              const total = items.reduce(
                (sum, item) => sum + item.quantity * item.unitCost,
                0,
              )
              return items.length > 0 ? (
                <div className="flex justify-between items-center py-3 border-t">
                  <span className="font-medium">Total Pesanan:</span>
                  <span className="text-lg font-bold">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(total)}
                  </span>
                </div>
              ) : null
            }}
          </form.Subscribe>
        </form>

        <SheetFooter className="px-4 pb-4 pt-4">
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
