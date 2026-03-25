import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Plus, X, Check, Package, Users, User } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCustomers } from '@/modules/customers'
import { useWarehouses } from '@/modules/warehouses'
import { useVariants } from '@/modules/products'
import type { Variant } from 'backend/src/modules/variants/variants.route'

const salesOrderItemSchema = z.object({
  variantId: z.string().min(1, 'Produk wajib dipilih'),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
  unitPrice: z.number().nonnegative('Harga satuan tidak boleh negatif'),
})

const createSalesOrderSchema = z.object({
  customerId: z.string().optional(),
  guestName: z.string().optional(),
  guestEmail: z.string().optional(),
  warehouseId: z.string().min(1, 'Gudang wajib dipilih'),
  items: z
    .array(salesOrderItemSchema)
    .min(1, 'Minimal 1 item wajib ditambahkan'),
})

interface SalesOrderFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    customerId?: string
    guestName?: string
    guestEmail?: string
    warehouseId: string
    items: Array<{ variantId: string; quantity: number; unitPrice: number }>
  }) => Promise<void>
  isPending: boolean
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

type CustomerType = 'existing' | 'guest'

export function SalesOrderFormSheet({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: SalesOrderFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [customerType, setCustomerType] =
    React.useState<CustomerType>('existing')

  const { data: customersData } = useCustomers({ pageSize: 100 })
  const { data: warehousesData } = useWarehouses({ pageSize: 100 })
  const { data: variantsData } = useVariants({ pageSize: 100 })

  const customers = customersData?.data ?? []
  const warehouses = warehousesData?.data ?? []
  const variants = variantsData?.data ?? []

  const form = useForm({
    defaultValues: {
      customerId: '',
      guestName: '',
      guestEmail: '',
      warehouseId: '',
      items: [] as Array<{
        variantId: string
        quantity: number
        unitPrice: number
      }>,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        // Prepare values based on customer type
        const submitValues = {
          warehouseId: value.warehouseId,
          items: value.items,
          ...(customerType === 'existing' && value.customerId
            ? { customerId: value.customerId }
            : {}),
          ...(customerType === 'guest' && value.guestName
            ? {
                guestName: value.guestName,
                ...(value.guestEmail ? { guestEmail: value.guestEmail } : {}),
              }
            : {}),
        }
        await onSubmit(submitValues)
      } catch (err) {
        const error = err as { message?: string }
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    },
  })

  // Reset form when sheet opens
  React.useEffect(() => {
    if (open) {
      setCustomerType('existing')
      form.setFieldValue('customerId', '')
      form.setFieldValue('guestName', '')
      form.setFieldValue('guestEmail', '')
      form.setFieldValue('warehouseId', '')
      form.setFieldValue('items', [])
      setServerError(null)
    }
  }, [open, form])

  // Handle tab change - clear the other tab's values
  const handleCustomerTypeChange = (value: string) => {
    const newType = value as CustomerType
    setCustomerType(newType)

    if (newType === 'existing') {
      // Clear guest fields when switching to existing customer
      form.setFieldValue('guestName', '')
      form.setFieldValue('guestEmail', '')
    } else {
      // Clear customerId when switching to guest
      form.setFieldValue('customerId', '')
    }
  }

  const title = 'Pesanan Baru'
  const description =
    'Buat pesanan penjualan baru. Pilih produk dan tentukan jumlah yang dipesan.'
  const submitLabel = 'Buat Pesanan'

  // Customer combobox state
  const [customerOpen, setCustomerOpen] = React.useState(false)
  const [customerQuery, setCustomerQuery] = React.useState('')
  const selectedCustomer = customers.find(
    (c) => c.id === form.getFieldValue('customerId'),
  )
  const filteredCustomers = React.useMemo(() => {
    if (!customerQuery) return customers
    const q = customerQuery.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, customerQuery])

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

          {/* Customer Selection Tabs */}
          <div className="space-y-3">
            <Label className="font-medium">Tipe Pelanggan</Label>
            <Tabs
              value={customerType}
              onValueChange={handleCustomerTypeChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="gap-2">
                  <Users className="h-4 w-4" />
                  Terdaftar
                </TabsTrigger>
                <TabsTrigger value="guest" className="gap-2">
                  <User className="h-4 w-4" />
                  Tamu
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="mt-4 space-y-4">
                <form.Field name="customerId">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name} className="font-medium">
                        Pilih Pelanggan
                      </Label>
                      <Combobox
                        open={customerOpen}
                        onOpenChange={setCustomerOpen}
                        value={field.state.value || null}
                        onValueChange={(value) => {
                          field.handleChange((value as string) || '')
                          setCustomerOpen(false)
                        }}
                      >
                        <ComboboxInput
                          placeholder={
                            selectedCustomer
                              ? selectedCustomer.name
                              : 'Cari dan pilih pelanggan...'
                          }
                          value={customerQuery}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCustomerQuery(e.target.value)
                          }
                          disabled={customers.length === 0}
                          className="w-full"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>
                              {customers.length === 0
                                ? 'Tidak ada pelanggan tersedia'
                                : 'Tidak ada pelanggan ditemukan'}
                            </ComboboxEmpty>
                            {filteredCustomers.map((c) => (
                              <ComboboxItem key={c.id} value={c.id}>
                                <span className="flex-1">{c.name}</span>
                                {field.state.value === c.id && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  )}
                </form.Field>
              </TabsContent>

              <TabsContent value="guest" className="mt-4 space-y-4">
                <form.Field name="guestName">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name} className="font-medium">
                        Nama Tamu
                      </Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Masukkan nama tamu"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="guestEmail">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name} className="font-medium">
                        Email Tamu{' '}
                        <span className="text-muted-foreground font-normal">
                          (opsional)
                        </span>
                      </Label>
                      <Input
                        id={field.name}
                        type="email"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Masukkan email tamu"
                      />
                    </div>
                  )}
                </form.Field>
              </TabsContent>
            </Tabs>
          </div>

          {/* Warehouse Combobox */}
          <form.Field
            name="warehouseId"
            validators={{
              onBlur: createSalesOrderSchema.shape.warehouseId,
              onSubmit: createSalesOrderSchema.shape.warehouseId,
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
                    unitPrice: 0,
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
                onSubmit: createSalesOrderSchema.shape.items,
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

                              {/* Unit Price Input */}
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground mb-1 block">
                                  Harga Satuan (Rp)
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) => {
                                    const newItems = [...items]
                                    newItems[index] = {
                                      ...item,
                                      unitPrice:
                                        parseFloat(e.target.value) || 0,
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
                (sum, item) => sum + item.quantity * item.unitPrice,
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
