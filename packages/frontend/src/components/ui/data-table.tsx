import * as React from 'react'
import { flexRender } from '@tanstack/react-table'
import type { Table as TanStackTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { cn } from '#lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table'
import {
  TableLoadingState,
  TableErrorState,
  TableSearchEmptyState,
  TableEmptyState,
} from './data-table-states'
import type {
  LoadingStateConfig,
  ErrorStateConfig,
  SearchEmptyStateConfig,
  EmptyStateConfig,
} from './data-table-states'

export type {
  LoadingStateConfig,
  ErrorStateConfig,
  SearchEmptyStateConfig,
  EmptyStateConfig,
}

export interface PaginationMeta {
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

interface PaginationState {
  pageIndex: number
  pageSize: number
}

interface DataTableProps<TData> {
  table: TanStackTable<TData>
  isLoading?: boolean
  isError?: boolean

  loadingState?: LoadingStateConfig
  errorState?: ErrorStateConfig
  searchEmptyState?: SearchEmptyStateConfig
  emptyState?: EmptyStateConfig
  emptyContent?: React.ReactNode

  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchAriaLabel?: string

  pagination?: PaginationState
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>
  meta?: PaginationMeta
  itemLabel?: string

  getHeaderClassName?: (headerId: string) => string | undefined
}

export function DataTable<TData>({
  table,
  isLoading,
  isError,
  loadingState,
  errorState,
  searchEmptyState,
  emptyState,
  emptyContent,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  pagination,
  onPaginationChange,
  meta,
  itemLabel,
  getHeaderClassName,
}: DataTableProps<TData>) {
  const colSpan = table.getHeaderGroups()[0]?.headers.length ?? 0

  const showSearch = search !== undefined && onSearchChange !== undefined

  return (
    <div className="flex flex-col gap-6">
      {showSearch && (
        <div className="relative w-full max-w-md group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-4 w-4" />
          </div>
          <Input
            placeholder={searchPlaceholder ?? 'Cari...'}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 h-11 bg-card border-border/60 hover:border-border focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl shadow-sm transition-all sm:text-sm"
            aria-label={searchAriaLabel ?? 'Cari'}
          />
        </div>
      )}

      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(getHeaderClassName?.(header.id))}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && loadingState ? (
              <TableLoadingState colSpan={colSpan} {...loadingState} />
            ) : isError && errorState ? (
              <TableErrorState colSpan={colSpan} {...errorState} />
            ) : table.getRowModel().rows.length === 0 ? (
              search && searchEmptyState ? (
                <TableSearchEmptyState
                  colSpan={colSpan}
                  search={search}
                  {...searchEmptyState}
                />
              ) : emptyState ? (
                <TableEmptyState colSpan={colSpan} {...emptyState} />
              ) : emptyContent ? (
                <TableRow className="hover:bg-transparent border-none">
                  <TableCell
                    colSpan={colSpan}
                    className="text-center py-24 whitespace-normal"
                  >
                    {emptyContent}
                  </TableCell>
                </TableRow>
              ) : null
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors duration-200"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && pagination && onPaginationChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-border/40 text-sm text-muted-foreground gap-5 sm:gap-0 mx-2 pb-6">
          <p className="text-center sm:text-left text-balance">
            Menampilkan{' '}
            <span className="text-foreground font-medium mx-1">
              {pagination.pageIndex * pagination.pageSize + 1}
            </span>
            –
            <span className="text-foreground font-medium mx-1">
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                meta.total,
              )}
            </span>
            dari{' '}
            <span className="text-foreground font-medium mx-1">
              {meta.total}
            </span>{' '}
            {itemLabel ?? 'item'}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
              disabled={!meta.hasPrev}
              onClick={() =>
                onPaginationChange((p) => ({
                  ...p,
                  pageIndex: p.pageIndex - 1,
                }))
              }
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
              disabled={!meta.hasNext}
              onClick={() =>
                onPaginationChange((p) => ({
                  ...p,
                  pageIndex: p.pageIndex + 1,
                }))
              }
            >
              Selanjutnya
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
