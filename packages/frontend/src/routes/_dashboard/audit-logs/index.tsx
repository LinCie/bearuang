import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'
import { ShieldCheck, KeyRound, User } from 'lucide-react'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'
import { useAuditLogs, AuditLogsFilters } from '#modules/audit-logs/index'
import type { AuditLog } from '#modules/audit-logs/index'

export const Route = createFileRoute('/_dashboard/audit-logs/')({
  component: AuditLogsPage,
})

function OperationBadge({ operation }: { operation: string }) {
  const styles: Record<string, string> = {
    create: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    update:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    delete: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    createMany:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    updateMany:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    deleteMany:
      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    restore:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    receive:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    accept:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    presign: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    confirm: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    reorder:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  }

  const labels: Record<string, string> = {
    create: 'Buat',
    update: 'Ubah',
    delete: 'Hapus',
    createMany: 'Buat Banyak',
    updateMany: 'Ubah Banyak',
    deleteMany: 'Hapus Banyak',
    restore: 'Pulihkan',
    receive: 'Terima',
    accept: 'Terima',
    reject: 'Tolak',
    presign: 'Presign',
    confirm: 'Konfirmasi',
    reorder: 'Urutkan',
  }

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[operation] ?? 'bg-muted text-muted-foreground'}`}
    >
      {labels[operation] ?? operation}
    </span>
  )
}

function AuthTypeBadge({ type }: { type: string }) {
  if (type === 'api_key') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <KeyRound className="h-3 w-3" />
        API Key
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
      <User className="h-3 w-3" />
      Sesi
    </span>
  )
}

function AuditLogsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [filters, setFilters] = React.useState({
    model: '',
    operation: '',
    authType: '',
  })

  const hasActiveFilters = Boolean(
    filters.model || filters.operation || filters.authType,
  )

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [filters.model, filters.operation, filters.authType])

  const sortBy = sorting[0]?.id as
    | 'createdAt'
    | 'model'
    | 'operation'
    | undefined
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

  const { data, isLoading, isError } = useAuditLogs({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
    model: filters.model || undefined,
    operation: filters.operation || undefined,
    authType: (filters.authType || undefined) as
      | 'session'
      | 'api_key'
      | undefined,
  })

  const logs = data?.data ?? []
  const meta = data?.meta

  const handleResetFilters = React.useCallback(() => {
    setFilters({ model: '', operation: '', authType: '' })
  }, [])

  const columns = React.useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} title="Waktu" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'model',
        header: ({ column }) => (
          <SortableHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
            {row.original.model}
          </span>
        ),
      },
      {
        accessorKey: 'operation',
        header: ({ column }) => (
          <SortableHeader column={column} title="Operasi" />
        ),
        cell: ({ row }) => (
          <OperationBadge operation={row.original.operation} />
        ),
      },
      {
        id: 'authType',
        header: 'Metode Auth',
        cell: ({ row }) => <AuthTypeBadge type={row.original.authType} />,
      },
      {
        id: 'userId',
        header: () => <span className="hidden lg:table-cell">Pengguna</span>,
        cell: ({ row }) => {
          const log = row.original
          const name = log.user?.name || log.apiKey?.name || log.userId || '—'
          return (
            <div className="hidden lg:table-cell text-sm text-muted-foreground">
              {name}
            </div>
          )
        },
      },

      {
        id: 'ipAddress',
        header: () => <span className="hidden xl:table-cell">IP</span>,
        cell: ({ row }) => (
          <div className="hidden xl:table-cell text-sm text-muted-foreground tabular-nums">
            {row.original.ipAddress ?? '—'}
          </div>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  return (
    <>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              Log Audit
            </h2>
            <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
              Pantau seluruh aktivitas perubahan data di organisasi Anda,
              termasuk operasi melalui sesi dan API key.
            </p>
          </div>
        </div>

        <AuditLogsFilters filters={filters} onFilterChange={setFilters} />
      </div>

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: ShieldCheck,
          title: 'Memuat log audit',
          description:
            'Tunggu sebentar ya, kami sedang mengambil log aktivitas Anda 🐻',
        }}
        errorState={{
          title: 'Gagal memuat log audit.',
          description:
            'Sepertinya ada sedikit kendala. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        emptyState={
          hasActiveFilters
            ? {
                icon: ShieldCheck,
                title: 'Tidak ada hasil yang cocok 🤔',
                description:
                  'Coba ubah filter untuk menemukan log aktivitas yang Anda cari.',
                action: {
                  label: 'Reset Filter',
                  onClick: handleResetFilters,
                },
              }
            : {
                icon: ShieldCheck,
                title: 'Belum ada log audit 🐻',
                description:
                  'Log audit akan muncul di sini setiap ada perubahan data di organisasi Anda. Semua operasi akan tercatat otomatis.',
              }
        }
        pagination={pagination}
        onPaginationChange={setPagination}
        meta={meta}
        itemLabel="log"
      />
    </>
  )
}
