import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import {
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  FileSearch,
  ClipboardList,
  ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAuditLogs,
  AuditLogsTable,
  AuditLogsFilters,
} from '@/modules/audit-logs'

export const Route = createFileRoute('/_dashboard/audit-logs/')({
  component: AuditLogsPage,
})

function AuditLogsPage() {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = React.useState<{
    sortBy: 'createdAt' | 'model' | 'operation'
    sortOrder: 'asc' | 'desc'
  }>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [filters, setFilters] = React.useState({
    model: '',
    operation: '',
    authType: '',
  })

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [filters.model, filters.operation, filters.authType])

  const { data, isLoading, isError } = useAuditLogs({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy: sorting.sortBy,
    sortOrder: sorting.sortOrder,
    model: filters.model || undefined,
    operation: filters.operation || undefined,
    authType: (filters.authType || undefined) as
      | 'session'
      | 'api_key'
      | undefined,
  })

  const logs = data?.data ?? []
  const meta = data?.meta

  const handleSort = React.useCallback(
    (column: 'createdAt' | 'model' | 'operation') => {
      setSorting((prev) => ({
        sortBy: column,
        sortOrder:
          prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      }))
    },
    [],
  )

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

      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        {isLoading ? (
          <div className="py-20">
            <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
              <div className="relative mb-8 mt-4 group">
                <div
                  className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl animate-pulse"
                  style={{ animationDuration: '3s' }}
                />
                <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-50/80 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 shadow-sm backdrop-blur-sm">
                  <ScrollText
                    className="h-9 w-9 text-orange-500 animate-bounce"
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
                  <span className="inline-block text-orange-900 dark:text-orange-100">
                    Memuat log audit
                  </span>
                  <span className="inline-flex gap-0.5 ml-0.5 text-orange-500">
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
                  Tunggu sebentar ya, kami sedang mengambil log aktivitas Anda
                </p>
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-destructive font-medium text-lg">
              Gagal memuat log audit.
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
              Sepertinya ada sedikit kendala. Mari kita coba sekali lagi.
            </p>
            <Button
              variant="outline"
              className="px-6"
              onClick={() => window.location.reload()}
            >
              Coba Muat Ulang
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-24">
            {filters.model || filters.operation || filters.authType ? (
              <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-8 group cursor-default">
                  <div className="absolute inset-0 bg-stone-100/80 dark:bg-stone-900/40 rounded-full blur-2xl group-hover:bg-stone-200/80 transition-colors duration-500" />
                  <div className="relative flex items-center justify-center">
                    <div className="absolute -top-3 -right-3 h-8 w-8 text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500 delay-100">
                      <FileSearch className="h-full w-full" />
                    </div>
                    <div className="relative h-20 w-20 rounded-2xl bg-stone-50 dark:bg-stone-900/30 border border-stone-200 dark:border-stone-800/50 flex items-center justify-center rotate-3 group-hover:rotate-12 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 shadow-sm group-hover:shadow-md cursor-help">
                      <ClipboardList className="h-8 w-8 text-stone-400 dark:text-stone-500 transition-transform duration-500 group-hover:scale-95 group-hover:opacity-80" />
                      <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:rotate-[-15deg] transition-all duration-500 delay-75">
                        <FileSearch className="h-5 w-5 text-stone-500 dark:text-stone-400" />
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-medium text-foreground mb-3 whitespace-normal">
                  Tidak ada hasil yang cocok
                </h3>
                <p className="text-muted-foreground text-sm max-w-[340px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                  Coba ubah filter untuk menemukan log aktivitas yang Anda cari.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({ model: '', operation: '', authType: '' })
                  }
                  className="px-8 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 duration-300 shadow-sm"
                >
                  Reset Filter
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-10 group cursor-default">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/30 transition-colors duration-700" />
                  <div className="relative flex items-center justify-center">
                    <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                      <ShieldCheck
                        className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                  Belum ada log audit
                </h3>
                <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                  Log audit akan muncul di sini setiap ada perubahan data di
                  organisasi Anda. Semua operasi akan tercatat otomatis.
                </p>
              </div>
            )}
          </div>
        ) : (
          <AuditLogsTable
            logs={logs}
            sortBy={sorting.sortBy}
            sortOrder={sorting.sortOrder}
            onSort={handleSort}
          />
        )}
      </div>

      {meta && meta.totalPages > 1 && !isLoading && logs.length > 0 && (
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
            log
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
