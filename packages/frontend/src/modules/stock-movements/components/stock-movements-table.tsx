import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { StockMovement, StockMovementType } from '@/modules/stock-movements'

interface StockMovementsTableProps {
  movements: StockMovement[]
  sortBy?: 'createdAt' | 'quantity' | 'type'
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: 'createdAt' | 'quantity' | 'type') => void
}

function getTypeBadgeStyles(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    case 'OUT':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    case 'ADJUSTMENT':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function getTypeLabel(type: StockMovementType) {
  switch (type) {
    case 'IN':
      return 'Masuk'
    case 'OUT':
      return 'Keluar'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    default:
      return type
  }
}

export function StockMovementsTable({
  movements,
  sortBy,
  sortOrder,
  onSort,
}: StockMovementsTableProps) {
  const renderSortButton = (
    column: 'createdAt' | 'quantity' | 'type',
    label: string,
  ) => (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => onSort?.(column)}
      className="-ml-2 group"
    >
      {label}
      {sortBy === column ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="ml-1 h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </Button>
  )

  return (
    <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
      <Table className="w-full min-w-[700px]">
        <TableHeader>
          <TableRow className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20">
            <TableHead className="font-medium text-foreground w-[18%]">
              {renderSortButton('createdAt', 'Tanggal')}
            </TableHead>
            <TableHead className="font-medium text-foreground w-[12%]">
              {renderSortButton('type', 'Tipe')}
            </TableHead>
            <TableHead className="font-medium text-foreground w-[25%]">
              Produk
            </TableHead>
            <TableHead className="font-medium text-foreground w-[18%]">
              Gudang
            </TableHead>
            <TableHead className="font-medium text-foreground text-right w-[10%]">
              {renderSortButton('quantity', 'Jumlah')}
            </TableHead>
            <TableHead className="font-medium text-foreground w-[17%]">
              Referensi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow
              key={m.id}
              className="border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200 cursor-default"
              title={m.note ?? undefined}
            >
              <TableCell className="text-muted-foreground text-sm">
                {new Date(m.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeStyles(m.type)}`}
                >
                  {getTypeLabel(m.type)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {m.variant.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {m.variant.sku}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-foreground">
                {m.warehouse.name}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  m.type === 'OUT'
                    ? 'text-rose-600 dark:text-rose-400'
                    : m.type === 'IN'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground'
                }`}
              >
                {m.type === 'OUT' ? '-' : '+'}
                {m.quantity}
              </TableCell>
              <TableCell className="text-sm">
                {m.referenceId ? (
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {m.referenceType}
                    </span>
                    <span className="font-mono text-xs truncate max-w-[120px]">
                      {m.referenceId.slice(0, 8)}...
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Manual
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
