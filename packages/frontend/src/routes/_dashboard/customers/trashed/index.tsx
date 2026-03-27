import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  ArrowLeft,
  Trash2,
  Mail,
  Phone,
  CheckCircle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useTrashedCustomers, useRestoreCustomer, customerKeys } from '@/modules/customers'
import type { Customer } from '@/modules/customers'
import { useDebounce } from '@/hooks/use-debounce'
import { useHasPermission } from '@/lib/use-permissions'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_dashboard/customers/trashed/')({
  component: TrashedCustomersPage,
})

function TrashedCustomersPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 300)

  const sortBy = sorting[0]?.id as
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const { data, isLoading, isError, refetch } = useTrashedCustomers({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    search: debouncedSearch || undefined,
  })

  const restoreCustomer = useRestoreCustomer()
  const canDelete = useHasPermission('customer:delete')
  const queryClient = useQueryClient()

  const customers = data?.data ?? []
  const meta = data?.meta

  const [restoringIds, setRestoringIds] = React.useState<Set<string>>(
    new Set(),
  )
  const [exitingIds, setExitingIds] = React.useState<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = React.useState<Set<string>>(new Set())

  const prefersReducedMotion = React.useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const EXIT_DURATION = prefersReducedMotion ? 0 : 280

  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>(
    {},
  )
  const [isBatchRestoring, setIsBatchRestoring] = React.useState(false)

  const selectedCount = Object.keys(rowSelection).length
  const hasSelection = selectedCount > 0

  const handleBatchRestore = React.useCallback(async () => {
    const selectedIds = Object.keys(rowSelection)
    if (selectedIds.length === 0) return

    setIsBatchRestoring(true)
    setRestoringIds(new Set(selectedIds))

    if (!prefersReducedMotion) {
      setExitingIds(new Set(selectedIds))
    }

    const previousData = queryClient.getQueryData<
      { data: Customer[]; meta?: { totalPages: number; total: number } }
    >(customerKeys.trashed())

    const animationTimer = setTimeout(() => {
      queryClient.setQueryData(
        customerKeys.trashed(),
        (old: typeof previousData) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.filter((c) => !selectedIds.includes(c.id)),
          }
        },
      )
    }, EXIT_DURATION)

    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => restoreCustomer.mutateAsync(id)),
      )
      const restored = previousData?.data.filter((c) =>
        selectedIds.includes(c.id),
      ) ?? []
      const failedCount = results.filter(
        (r) => r.status === 'rejected',
      ).length
      if (failedCount > 0) {
        clearTimeout(animationTimer)
        toast.error(
          `${failedCount} dari ${restored.length} pelanggan gagal dipulihkan`,
        )
        queryClient.invalidateQueries({ queryKey: customerKeys.trashed() })
      } else {
        toast.success(
          `${restored.length} pelanggan telah dipulihkan`,
        )
      }
      setExitingIds(new Set())
      setRowSelection({})
    } finally {
      setIsBatchRestoring(false)
      setRestoringIds(new Set())
    }
  }, [rowSelection, queryClient, prefersReducedMotion, EXIT_DURATION, restoreCustomer])

  const handleRestore = React.useCallback(
    async (customer: Customer) => {
      const customerId = customer.id
      setRestoringIds((prev) => new Set(prev).add(customerId))

      if (!prefersReducedMotion) {
        setExitingIds((prev) => new Set(prev).add(customerId))
      }

      const previousData = queryClient.getQueryData<
        { data: Customer[]; meta?: { totalPages: number; total: number } }
      >(customerKeys.trashed())

      const animationTimer = setTimeout(() => {
        queryClient.setQueryData(
          customerKeys.trashed(),
          (old: typeof previousData) => {
            if (!old) return old
            return {
              ...old,
              data: old.data.filter((c) => c.id !== customerId),
            }
          },
        )
      }, EXIT_DURATION)

      try {
        await restoreCustomer.mutateAsync(customerId)
        toast.success(`Pelanggan "${customer.name}" telah dipulihkan`)
        setExitingIds((prev) => {
          const next = new Set(prev)
          next.delete(customerId)
          return next
        })
      } catch {
        clearTimeout(animationTimer)
        toast.error('Gagal memulihkan pelanggan')
        if (previousData) {
          queryClient.setQueryData(customerKeys.trashed(), previousData)
          setExitingIds((prev) => {
            const next = new Set(prev)
            next.delete(customerId)
            return next
          })
          if (!prefersReducedMotion) {
            setEnteringIds((prev) => new Set(prev).add(customerId))
            setTimeout(() => {
              setEnteringIds((prev) => {
                const next = new Set(prev)
                next.delete(customerId)
                return next
              })
            }, 300)
          }
        }
      } finally {
        setRestoringIds((prev) => {
          const next = new Set(prev)
          next.delete(customerId)
          return next
        })
      }
    },
    [restoreCustomer, queryClient, prefersReducedMotion, EXIT_DURATION],
  )

  const columns = React.useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: 'select',
        header: ({ table: t }) => (
          <Checkbox
            checked={
              t.getIsAllPageRowsSelected() ||
              (t.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
              t.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Pilih semua pelanggan"
            disabled={!canDelete || isBatchRestoring}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Pilih ${row.original.name}`}
            disabled={
              restoringIds.has(row.original.id) ||
              exitingIds.has(row.original.id) ||
              isBatchRestoring
            }
          />
        ),
        size: 40,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Nama
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px] md:max-w-[400px]">
            <span className="font-medium text-foreground truncate">
              {row.original.name}
            </span>
            {row.original.email && (
              <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1 flex items-center gap-1">
                <Mail className="h-3 w-3 flex-shrink-0" />
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Telepon',
        cell: ({ row }) => {
          const phone = row.original.phone
          if (!phone)
            return (
              <span className="text-muted-foreground text-sm italic">-</span>
            )
          return (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {phone}
            </span>
          )
        },
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Dihapus Pada
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.updatedAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const isRestoring = restoringIds.has(row.original.id)
          return (
            <div className="flex items-center justify-end gap-2">
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary hover:bg-primary/10 transition-all gap-2 active:scale-95"
                  onClick={() => handleRestore(row.original)}
                  disabled={isRestoring}
                >
                  <RotateCcw
                    className={`h-4 w-4 transition-transform duration-700 ${isRestoring ? 'animate-spin' : 'group-hover/row:-rotate-45'}`}
                  />
                  Pulihkan
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [handleRestore, canDelete, restoringIds, exitingIds, isBatchRestoring],
  )

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) =>
      !restoringIds.has(row.original.id) &&
      !exitingIds.has(row.original.id) &&
      !isBatchRestoring,
    state: { sorting, rowSelection },
  })

  return (
    <>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col gap-4">
          <Link
            to="/customers"
            className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-fit gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Pelanggan
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-muted-foreground" />
                Pelanggan Terhapus
              </h2>
              <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
                Daftar pelanggan yang telah dihapus. Anda dapat memulihkannya
                kembali ke daftar aktif.
              </p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-md group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search className="h-4 w-4" />
          </div>
          <Input
            placeholder="Cari pelanggan terhapus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 h-11 bg-card border-border/60 hover:border-border focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl shadow-sm transition-all sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {isLoading ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={columns.length} className="py-20">
                  <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="relative mb-8 mt-4 group">
                      <div
                        className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl animate-pulse"
                        style={{ animationDuration: '3s' }}
                      />
                      <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 shadow-sm backdrop-blur-sm">
                        <RotateCcw
                          className="h-9 w-9 text-amber-500 animate-bounce"
                          style={{ animationDuration: '1.5s' }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div
                        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/5 dark:bg-white/5 rounded-[100%] blur-[3px] animate-pulse"
                        style={{ animationDuration: '1.5s' }}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <h3 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-1">
                        <span className="inline-block text-amber-900 dark:text-amber-100">
                          Memuat pelanggan terhapus
                        </span>
                        <span className="inline-flex gap-0.5 ml-0.5 text-amber-500">
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '0ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '150ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{
                              animationDelay: '300ms',
                              animationDuration: '1.5s',
                            }}
                          >
                            .
                          </span>
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-[250px] mx-auto text-balance">
                        Tunggu sebentar ya, kami sedang mengambil data pelanggan
                        terhapus Anda
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-16"
                >
                  <p className="text-destructive font-medium text-lg">
                    Aduh, gagal memuat pelanggan terhapus.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
                    Sepertinya ada sedikit kendala jaringan. Mari kita coba
                    sekali lagi.
                  </p>
                  <Button
                    variant="outline"
                    className="px-6"
                    onClick={() => refetch()}
                  >
                    Coba Muat Ulang
                  </Button>
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24 whitespace-normal"
                >
                  <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="relative mb-10 group cursor-default">
                      <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />
                      <div className="relative flex items-center justify-center">
                        <div className="absolute -top-5 -left-4 h-11 w-11 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center -rotate-12 group-hover:-rotate-25 group-hover:-translate-x-3 group-hover:-translate-y-2 transition-all duration-500 shadow-sm backdrop-blur-md">
                          <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="absolute -bottom-3 -right-4 h-9 w-9 rounded-lg bg-green-50/90 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 flex items-center justify-center rotate-6 group-hover:rotate-12 group-hover:translate-x-2 group-hover:translate-y-1 transition-all duration-500 shadow-sm backdrop-blur-md delay-75">
                          <CheckCircle className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="relative z-10 h-24 w-24 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer animate-[float_6s_ease-in-out_infinite]">
                          <Trash2
                            className="h-10 w-10 text-muted-foreground/60 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                            strokeWidth={1.5}
                          />
                        </div>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                      Kosong melompong!
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                      Tidak ada pelanggan yang terhapus. Semua data pelanggan
                      Anda masih aman dan terjaga.
                    </p>
                    <Link to="/customers">
                      <Button
                        variant="outline"
                        className="px-8 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali ke Daftar Pelanggan
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    'group/row border-b border-border/40 transition-colors duration-200',
                    !exitingIds.has(row.original.id) &&
                      !enteringIds.has(row.original.id) &&
                      'hover:bg-amber-50/30 dark:hover:bg-amber-900/10',
                    exitingIds.has(row.original.id) &&
                      'opacity-0 -translate-x-6 pointer-events-none transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
                    enteringIds.has(row.original.id) &&
                      'animate-in fade-in slide-in-from-left-4 duration-300',
                  )}
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

      {hasSelection && customers.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg border border-border/20 backdrop-blur-sm">
            <span className="text-sm font-medium">
              {selectedCount} pelanggan dipilih
            </span>
            <div className="w-px h-5 bg-background/20" />
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 active:scale-95 transition-transform"
              onClick={handleBatchRestore}
              disabled={isBatchRestoring}
            >
              <RotateCcw
                className={`h-4 w-4 ${isBatchRestoring ? 'animate-spin' : ''}`}
              />
              Pulihkan Semua
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-background/60 hover:text-background hover:bg-background/10"
              onClick={() => setRowSelection({})}
              disabled={isBatchRestoring}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Batalkan pilihan</span>
            </Button>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-border/40 text-sm text-muted-foreground gap-5 sm:gap-0 mx-2 pb-6">
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
            pelanggan terhapus
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="px-5 shadow-sm"
              disabled={!meta.hasPrev}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
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
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
              }
            >
              Selanjutnya
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
