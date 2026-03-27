import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/lib/use-permissions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProductVariant } from 'backend/src/modules/products/products.route'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

interface TrashedVariantsTableProps {
  variants: ProductVariant[]
  onRestore: (variant: ProductVariant) => void
  isRestorePending?: boolean
}

export function TrashedVariantsTable({
  variants,
  onRestore,
  isRestorePending,
}: TrashedVariantsTableProps) {
  const canUpdate = useHasPermission('product:update')

  if (variants.length === 0) return null

  return (
    <div className="flex flex-col gap-4 mt-8 pt-8 border-t border-dashed border-border/60">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Varian Terhapus
        </h3>
        <p className="text-xs text-muted-foreground">
          Varian di bawah ini telah dihapus. Anda dapat memulihkannya jika
          diperlukan.
        </p>
      </div>
      <div className="bg-muted/30 border border-border/40 rounded-xl overflow-x-auto">
        <Table className="w-full min-w-[700px]">
          <TableHeader>
            <TableRow className="border-b border-border/40 bg-muted/40">
              <TableHead className="font-medium text-foreground w-[15%]">
                SKU
              </TableHead>
              <TableHead className="font-medium text-foreground w-[30%]">
                Nama Varian
              </TableHead>
              <TableHead className="font-medium text-foreground w-[15%] text-right">
                Harga
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
                className="group border-b border-border/20 hover:bg-muted/50 transition-colors duration-200"
              >
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {v.sku || '-'}
                </TableCell>
                <TableCell className="font-medium text-sm text-muted-foreground">
                  {v.name || 'Tanpa Nama'}
                </TableCell>
                <TableCell className="text-right font-medium text-sm text-muted-foreground">
                  {currencyFormatter.format(v.price || 0)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end pr-2">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary hover:bg-primary/10 h-8 gap-1.5 px-3"
                        onClick={() => onRestore(v)}
                        disabled={isRestorePending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Pulihkan
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
