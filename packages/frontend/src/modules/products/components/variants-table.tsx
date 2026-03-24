import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProductVariant } from 'backend/src/modules/products/products.route'

interface VariantsTableProps {
  variants: ProductVariant[]
  onEdit: (variant: ProductVariant) => void
  onDelete: (variant: ProductVariant) => void
}

export function VariantsTable({
  variants,
  onEdit,
  onDelete,
}: VariantsTableProps) {
  return (
    <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
      <Table className="w-full min-w-[700px]">
        <TableHeader>
          <TableRow className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20">
            <TableHead className="font-medium text-foreground w-[15%]">
              SKU
            </TableHead>
            <TableHead className="font-medium text-foreground w-[30%]">
              Nama Varian
            </TableHead>
            <TableHead className="font-medium text-foreground w-[15%]">
              Stok
            </TableHead>
            <TableHead className="font-medium text-foreground text-right w-[20%]">
              Harga
            </TableHead>
            <TableHead className="font-medium text-foreground w-[10%]">
              Status
            </TableHead>
            <TableHead className="w-[10%]">
              <span className="sr-only">Aksi</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((v) => (
            <TableRow
              key={v.id}
              className="group border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200 cursor-default"
            >
              <TableCell className="text-xs font-mono text-muted-foreground/80 group-hover:text-foreground/80 transition-colors">
                {v.sku || '-'}
              </TableCell>
              <TableCell className="font-medium text-[15px]">
                {v.name || 'Tanpa Nama'}
              </TableCell>
              <TableCell>
                <span className="text-[15px]">
                  {v.stock}{' '}
                  <span className="text-muted-foreground/70 text-sm ml-0.5">
                    {v.unit || 'pcs'}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right font-medium text-[15px]">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  maximumFractionDigits: 0,
                }).format(v.price || 0)}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    v.isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      v.isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                  />
                  {v.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => onEdit(v)}
                    title="Edit varian"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit varian</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => onDelete(v)}
                    title="Hapus varian"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Hapus varian</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
