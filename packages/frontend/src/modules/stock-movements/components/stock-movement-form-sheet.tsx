import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProducts } from '@/modules/products'
import type { StockMovementType } from '@/modules/stock-movements'
import { Check } from 'lucide-react'

const stockMovementSchema = z.object({
  warehouseId: z.string().min(1, 'Gudang wajib dipilih'),
  variantId: z.string().min(1, 'Varian produk wajib dipilih'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(1, 'Kuantitas minimal 1'),
  note: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
})

interface Warehouse {
  id: string
  name: string
}

interface Variant {
  id: string
  name: string
  sku: string
}

interface ProductVariant {
  id: string
  name: string
  sku: string
}

interface Product {
  id: string
  name: string
  variants?: ProductVariant[]
}

interface StockMovementFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouses: Warehouse[]
  variants: Variant[]
  onSubmit: (values: {
    warehouseId: string
    variantId: string
    type: StockMovementType
    quantity: number
    note: string
  }) => Promise<void>
  isPending: boolean
  preselectedWarehouseId?: string
  preselectedVariantId?: string
}

export function StockMovementFormSheet({
  open,
  onOpenChange,
  warehouses,
  variants,
  onSubmit,
  isPending,
  preselectedWarehouseId,
  preselectedVariantId,
}: StockMovementFormSheetProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      warehouseId: preselectedWarehouseId ?? '',
      variantId: preselectedVariantId ?? '',
      type: 'ADJUSTMENT' as StockMovementType,
      quantity: 1,
      note: '',
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

  // Reset form when sheet opens/closes or preselected values change
  React.useEffect(() => {
    if (open) {
      form.setFieldValue('warehouseId', preselectedWarehouseId ?? '')
      form.setFieldValue('variantId', preselectedVariantId ?? '')
      form.setFieldValue('type', 'ADJUSTMENT')
      form.setFieldValue('quantity', 1)
      form.setFieldValue('note', '')
      setServerError(null)
    }
  }, [open, preselectedWarehouseId, preselectedVariantId])

  const typeOptions: { value: StockMovementType; label: string }[] = [
    { value: 'IN', label: 'Masuk (IN)' },
    { value: 'OUT', label: 'Keluar (OUT)' },
    { value: 'ADJUSTMENT', label: 'Penyesuaian (ADJUSTMENT)' },
  ]

  // Fetch products list
  const { data: productsData } = useProducts({ pageSize: 100 })
  const products: Product[] = (productsData?.data as Product[]) ?? []

  // Track selected product
  const [selectedProductId, setSelectedProductId] = React.useState<string>('')

  // When a variant is selected, find its product
  React.useEffect(() => {
    const variantId = form.getFieldValue('variantId')
    if (variantId) {
      const variant = variants.find((v) => v.id === variantId)
      if (variant) {
        // Find which product this variant belongs to
        const product = products.find((p: Product) =>
          p.variants?.some((v: ProductVariant) => v.id === variantId),
        )
        if (product) {
          setSelectedProductId(product.id)
        }
      }
    }
  }, [form.getFieldValue('variantId'), variants, products])

  // Filter variants by selected product
  const filteredVariants = React.useMemo(() => {
    if (!selectedProductId) return []
    return variants.filter((v: Variant) => {
      const product = products.find((p: Product) =>
        p.variants?.some((pv: ProductVariant) => pv.id === v.id),
      )
      return product?.id === selectedProductId
    })
  }, [selectedProductId, variants, products])

  // Product combobox state
  const [productOpen, setProductOpen] = React.useState(false)
  const [productQuery, setProductQuery] = React.useState('')
  const selectedProduct = products.find(
    (p: Product) => p.id === selectedProductId,
  )
  const filteredProducts = React.useMemo(() => {
    if (!productQuery) return products
    const q = productQuery.toLowerCase()
    return products.filter((p: Product) => p.name.toLowerCase().includes(q))
  }, [products, productQuery])

  // Variant combobox state
  const [variantOpen, setVariantOpen] = React.useState(false)
  const [variantQuery, setVariantQuery] = React.useState('')
  const selectedVariant = variants.find(
    (v: Variant) => v.id === form.getFieldValue('variantId'),
  )
  const filteredVariantsSearch = React.useMemo(() => {
    if (!variantQuery) return filteredVariants
    const q = variantQuery.toLowerCase()
    return filteredVariants.filter(
      (v: Variant) =>
        v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q),
    )
  }, [filteredVariants, variantQuery])

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
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHead className="mb-6">
          <SheetTitle className="text-2xl">Pergerakan Stok Baru</SheetTitle>
          <SheetDescription className="text-base mt-1 text-balance">
            Catat perubahan stok barang di gudang. Pastikan data akurat untuk
            pelacakan inventori yang tepat.
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

          {/* Warehouse Combobox */}
          <form.Field
            name="warehouseId"
            validators={{
              onBlur: stockMovementSchema.shape.warehouseId,
              onSubmit: stockMovementSchema.shape.warehouseId,
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

          {/* Product Combobox */}
          <div className="space-y-1.5">
            <Label className="font-medium">
              Produk <span className="text-destructive">*</span>
            </Label>
            <Combobox
              open={productOpen}
              onOpenChange={setProductOpen}
              value={selectedProductId || null}
              onValueChange={(value) => {
                setSelectedProductId((value as string) || '')
                // Clear variant when product changes
                form.setFieldValue('variantId', '')
                setProductOpen(false)
              }}
            >
              <ComboboxInput
                placeholder={
                  selectedProduct
                    ? selectedProduct.name
                    : 'Cari dan pilih produk...'
                }
                value={productQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProductQuery(e.target.value)
                }
                disabled={products.length === 0}
                className="w-full"
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>
                    {products.length === 0
                      ? 'Tidak ada produk tersedia'
                      : 'Tidak ada produk ditemukan'}
                  </ComboboxEmpty>
                  {filteredProducts.map((p: Product) => (
                    <ComboboxItem key={p.id} value={p.id}>
                      <span className="flex-1">{p.name}</span>
                      {selectedProductId === p.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {!selectedProductId && form.getFieldValue('variantId') === '' && (
              <p className="text-xs text-muted-foreground">
                Pilih produk terlebih dahulu
              </p>
            )}
          </div>

          {/* Variant Combobox */}
          <form.Field
            name="variantId"
            validators={{
              onBlur: stockMovementSchema.shape.variantId,
              onSubmit: stockMovementSchema.shape.variantId,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Varian Produk <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  open={variantOpen}
                  onOpenChange={setVariantOpen}
                  value={field.state.value || null}
                  onValueChange={(value) => {
                    field.handleChange((value as string) || '')
                    setVariantOpen(false)
                  }}
                  disabled={!selectedProductId || filteredVariants.length === 0}
                >
                  <ComboboxInput
                    placeholder={
                      !selectedProductId
                        ? 'Pilih produk terlebih dahulu'
                        : selectedVariant
                          ? `${selectedVariant.name} (${selectedVariant.sku})`
                          : 'Cari dan pilih varian...'
                    }
                    value={variantQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVariantQuery(e.target.value)
                    }
                    disabled={
                      !selectedProductId || filteredVariants.length === 0
                    }
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty>
                        {!selectedProductId
                          ? 'Pilih produk terlebih dahulu'
                          : 'Tidak ada varian untuk produk ini'}
                      </ComboboxEmpty>
                      {filteredVariantsSearch.map((v: Variant) => (
                        <ComboboxItem key={v.id} value={v.id}>
                          <div className="flex-1 flex flex-col gap-0.5">
                            <span className="font-medium">{v.name}</span>
                            <span className="text-xs text-muted-foreground">
                              SKU: {v.sku}
                            </span>
                          </div>
                          {field.state.value === v.id && (
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

          {/* Type */}
          <form.Field
            name="type"
            validators={{
              onBlur: stockMovementSchema.shape.type,
              onSubmit: stockMovementSchema.shape.type,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Tipe Pergerakan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as StockMovementType)
                  }
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder="Pilih tipe pergerakan" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Quantity */}
          <form.Field
            name="quantity"
            validators={{
              onBlur: stockMovementSchema.shape.quantity,
              onSubmit: stockMovementSchema.shape.quantity,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Kuantitas <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min={1}
                  placeholder="Jumlah barang"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value, 10) || 0)
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

          {/* Note */}
          <form.Field name="note">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="font-medium">
                  Catatan
                </Label>
                <Textarea
                  id={field.name}
                  placeholder="Tambahkan catatan untuk pergerakan stok ini (opsional)..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Catatan membantu melacak alasan perubahan stok di kemudian
                  hari.
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
                  {isSubmitting || isPending
                    ? 'Menyimpan...'
                    : 'Catat Pergerakan'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
