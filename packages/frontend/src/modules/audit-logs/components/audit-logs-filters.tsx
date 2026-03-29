import * as React from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AuditLogsFiltersProps {
  filters: {
    model: string
    operation: string
    authType: string
  }
  onFilterChange: (filters: {
    model: string
    operation: string
    authType: string
  }) => void
}

const MODEL_OPTIONS = [
  { value: 'Product', label: 'Produk' },
  { value: 'ProductVariant', label: 'Varian Produk' },
  { value: 'Warehouse', label: 'Gudang' },
  { value: 'StockMovement', label: 'Pergerakan Stok' },
  { value: 'Supplier', label: 'Pemasok' },
  { value: 'Customer', label: 'Pelanggan' },
  { value: 'PurchaseOrder', label: 'Pesanan Pembelian' },
  { value: 'SalesOrder', label: 'Pesanan Penjualan' },
  { value: 'Member', label: 'Anggota' },
  { value: 'Invitation', label: 'Undangan' },
  { value: 'Apikey', label: 'API Key' },
  { value: 'Media', label: 'Media' },
]

const OPERATION_OPTIONS = [
  { value: 'create', label: 'Buat' },
  { value: 'update', label: 'Ubah' },
  { value: 'delete', label: 'Hapus' },
  { value: 'restore', label: 'Pulihkan' },
  { value: 'receive', label: 'Terima' },
  { value: 'accept', label: 'Terima' },
  { value: 'reject', label: 'Tolak' },
  { value: 'presign', label: 'Presign' },
  { value: 'confirm', label: 'Konfirmasi' },
  { value: 'reorder', label: 'Urutkan' },
  { value: 'createMany', label: 'Buat Banyak' },
  { value: 'updateMany', label: 'Ubah Banyak' },
  { value: 'deleteMany', label: 'Hapus Banyak' },
]

function Badge({
  children,
  onRemove,
}: {
  children: React.ReactNode
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
        aria-label="Hapus filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function AuditLogsFilters({
  filters,
  onFilterChange,
}: AuditLogsFiltersProps) {
  const hasActiveFilters = !!(
    filters.model ||
    filters.operation ||
    filters.authType
  )

  const modelLabel =
    MODEL_OPTIONS.find((o) => o.value === filters.model)?.label ?? filters.model
  const operationLabel =
    OPERATION_OPTIONS.find((o) => o.value === filters.operation)?.label ??
    filters.operation
  const authTypeLabel =
    filters.authType === 'session'
      ? 'Sesi'
      : filters.authType === 'api_key'
        ? 'API Key'
        : filters.authType

  function removeFilter(key: 'model' | 'operation' | 'authType') {
    onFilterChange({ ...filters, [key]: '' })
  }

  function resetAll() {
    onFilterChange({ model: '', operation: '', authType: '' })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filter</span>
        </div>

        <Select
          value={filters.model || '__all__'}
          onValueChange={(v) =>
            onFilterChange({ ...filters, model: v === '__all__' ? '' : v })
          }
        >
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Semua Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Model</SelectItem>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.operation || '__all__'}
          onValueChange={(v) =>
            onFilterChange({
              ...filters,
              operation: v === '__all__' ? '' : v,
            })
          }
        >
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Semua Operasi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Operasi</SelectItem>
            {OPERATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.authType || '__all__'}
          onValueChange={(v) =>
            onFilterChange({
              ...filters,
              authType: v === '__all__' ? '' : v,
            })
          }
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Semua Metode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Metode</SelectItem>
            <SelectItem value="session">Sesi</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.model && (
            <Badge onRemove={() => removeFilter('model')}>
              Model: {modelLabel}
            </Badge>
          )}
          {filters.operation && (
            <Badge onRemove={() => removeFilter('operation')}>
              Operasi: {operationLabel}
            </Badge>
          )}
          {filters.authType && (
            <Badge onRemove={() => removeFilter('authType')}>
              Auth: {authTypeLabel}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={resetAll}
          >
            Reset semua
          </Button>
        </div>
      )}
    </div>
  )
}
