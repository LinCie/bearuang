import * as React from 'react'
import { X, Filter, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { StockMovementType } from '@/modules/stock-movements'

interface Warehouse {
  id: string
  name: string
}

interface Variant {
  id: string
  name: string
  sku: string
}

interface StockMovementsFiltersProps {
  warehouses: Warehouse[]
  variants: Variant[]
  filters: {
    warehouseId: string
    variantId: string
    type: StockMovementType | ''
    search: string
  }
  onFilterChange: (filters: {
    warehouseId: string
    variantId: string
    type: StockMovementType | ''
    search: string
  }) => void
  preselectedWarehouseId?: string
  preselectedVariantId?: string
}

export function StockMovementsFilters({
  warehouses,
  variants,
  filters,
  onFilterChange,
  preselectedWarehouseId,
  preselectedVariantId,
}: StockMovementsFiltersProps) {
  const hasActiveFilters =
    filters.warehouseId || filters.variantId || filters.type || filters.search

  const handleReset = () => {
    onFilterChange({
      warehouseId: preselectedWarehouseId ?? '',
      variantId: preselectedVariantId ?? '',
      type: '',
      search: '',
    })
  }

  const typeOptions: { value: StockMovementType; label: string }[] = [
    { value: 'IN', label: 'Masuk' },
    { value: 'OUT', label: 'Keluar' },
    { value: 'ADJUSTMENT', label: 'Penyesuaian' },
  ]

  // Warehouse combobox state
  const [warehouseOpen, setWarehouseOpen] = React.useState(false)
  const [warehouseQuery, setWarehouseQuery] = React.useState('')
  const selectedWarehouse = warehouses.find((w) => w.id === filters.warehouseId)
  const filteredWarehouses = React.useMemo(() => {
    if (!warehouseQuery) return warehouses
    const q = warehouseQuery.toLowerCase()
    return warehouses.filter((w) => w.name.toLowerCase().includes(q))
  }, [warehouses, warehouseQuery])

  // Variant combobox state
  const [variantOpen, setVariantOpen] = React.useState(false)
  const [variantQuery, setVariantQuery] = React.useState('')
  const selectedVariant = variants.find((v) => v.id === filters.variantId)
  const filteredVariants = React.useMemo(() => {
    if (!variantQuery) return variants
    const q = variantQuery.toLowerCase()
    return variants.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q),
    )
  }, [variants, variantQuery])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Filter className="h-4 w-4" />
          </div>
          <Input
            placeholder="Cari produk atau catatan..."
            value={filters.search}
            onChange={(e) =>
              onFilterChange({ ...filters, search: e.target.value })
            }
            className="pl-10 h-11 bg-card border-border/60 hover:border-border focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl shadow-sm transition-all"
            aria-label="Cari pergerakan stok"
          />
        </div>

        {/* Warehouse Combobox Filter */}
        {!preselectedWarehouseId && (
          <Combobox
            open={warehouseOpen}
            onOpenChange={setWarehouseOpen}
            value={filters.warehouseId || null}
            onValueChange={(value) => {
              onFilterChange({
                ...filters,
                warehouseId: (value as string) || '',
              })
              setWarehouseOpen(false)
            }}
          >
            <ComboboxInput
              placeholder={
                selectedWarehouse ? selectedWarehouse.name : 'Pilih gudang...'
              }
              value={warehouseQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setWarehouseQuery(e.target.value)
              }
              showClear={!!filters.warehouseId}
              className="w-full sm:w-[220px] h-11"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  Tidak ada gudang ditemukan
                </ComboboxEmpty>
                <ComboboxItem value="" className="text-muted-foreground">
                  <span className="flex-1">Semua Gudang</span>
                  {!filters.warehouseId && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </ComboboxItem>
                {filteredWarehouses.map((w) => (
                  <ComboboxItem key={w.id} value={w.id}>
                    <span className="flex-1">{w.name}</span>
                    {filters.warehouseId === w.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}

        {/* Variant Combobox Filter */}
        {!preselectedVariantId && (
          <Combobox
            open={variantOpen}
            onOpenChange={setVariantOpen}
            value={filters.variantId || null}
            onValueChange={(value) => {
              onFilterChange({ ...filters, variantId: (value as string) || '' })
              setVariantOpen(false)
            }}
          >
            <ComboboxInput
              placeholder={
                selectedVariant
                  ? `${selectedVariant.name} (${selectedVariant.sku})`
                  : 'Pilih produk...'
              }
              value={variantQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setVariantQuery(e.target.value)
              }
              showClear={!!filters.variantId}
              className="w-full sm:w-[280px] h-11"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  Tidak ada produk ditemukan
                </ComboboxEmpty>
                <ComboboxItem value="" className="text-muted-foreground">
                  <span className="flex-1">Semua Produk</span>
                  {!filters.variantId && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </ComboboxItem>
                {filteredVariants.map((v) => (
                  <ComboboxItem key={v.id} value={v.id}>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.sku}
                      </span>
                    </div>
                    {filters.variantId === v.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}

        {/* Type Filter */}
        <Select
          value={filters.type || '__all__'}
          onValueChange={(value) =>
            onFilterChange({
              ...filters,
              type: value === '__all__' ? '' : (value as StockMovementType),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px] h-11">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Tipe</SelectItem>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          {filters.warehouseId && (
            <Badge
              label={
                warehouses.find((w) => w.id === filters.warehouseId)?.name ??
                'Gudang'
              }
              onRemove={() => onFilterChange({ ...filters, warehouseId: '' })}
            />
          )}
          {filters.variantId && (
            <Badge
              label={
                variants.find((v) => v.id === filters.variantId)?.name ??
                'Produk'
              }
              onRemove={() => onFilterChange({ ...filters, variantId: '' })}
            />
          )}
          {filters.type && (
            <Badge
              label={
                typeOptions.find((t) => t.value === filters.type)?.label ?? ''
              }
              onRemove={() => onFilterChange({ ...filters, type: '' })}
            />
          )}
          {filters.search && (
            <Badge
              label={`"${filters.search}"`}
              onRemove={() => onFilterChange({ ...filters, search: '' })}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            Reset semua
          </Button>
        </div>
      )}
    </div>
  )
}

interface BadgeProps {
  label: string
  onRemove: () => void
}

function Badge({ label, onRemove }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-primary/20 rounded p-0.5 transition-colors"
        aria-label={`Hapus filter ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
