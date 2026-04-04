import type { Column } from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '#components/ui/button'

interface SortableHeaderProps<TData> {
  column: Column<TData, unknown>
  title: string
}

export function SortableHeader<TData>({
  column,
  title,
}: SortableHeaderProps<TData>) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-2 group"
    >
      {title}
      {column.getIsSorted() === 'asc' ? (
        <ArrowUp className="ml-1 h-3.5 w-3.5" />
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </Button>
  )
}
