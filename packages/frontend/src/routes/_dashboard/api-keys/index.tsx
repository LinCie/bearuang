import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  KeyRound,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  ApiKeyFormSheet,
  DeleteDialog,
} from '@/modules/api-keys'
import type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '@/modules/api-keys'
import { useHasPermission } from '@/lib/use-permissions'

export const Route = createFileRoute('/_dashboard/api-keys/')({
  component: ApiKeysPage,
})

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Belum pernah'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins}m lalu`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}j lalu`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}h lalu`
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRateLimit(max: number | null, window: number | null): string {
  if (!max) return '-'
  const windowSec = (window ?? 86400000) / 1000
  if (windowSec >= 86400)
    return `${max.toLocaleString('id-ID')}/${Math.round(windowSec / 86400)}h`
  if (windowSec >= 3600)
    return `${max.toLocaleString('id-ID')}/${Math.round(windowSec / 3600)}j`
  return `${max.toLocaleString('id-ID')}/${windowSec}s`
}

function MaskedKey({
  prefix,
  start,
}: {
  prefix: string | null
  start: string | null
}) {
  const [copied, setCopied] = React.useState(false)
  const display = `${prefix ?? 'bk_'}••••••${start ?? '••••'}`

  const handleCopy = async () => {
    if (!prefix || !start) return
    await navigator.clipboard.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
      <code className="bg-muted px-2 py-0.5 rounded text-xs">{display}</code>
      {prefix && start && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          title={copied ? 'Tersalin!' : 'Salin'}
        >
          {copied ? (
            <Check className="h-3 w-3 text-primary" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      )}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────

function ApiKeysPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingKey, setEditingKey] = React.useState<ApiKey | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingKey, setDeletingKey] = React.useState<ApiKey | null>(null)

  // Secret display state (shown once on create)
  const [newKeySecret, setNewKeySecret] = React.useState<string | null>(null)

  const { data, isLoading, isError } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const updateApiKey = useUpdateApiKey()
  const deleteApiKey = useDeleteApiKey()

  const canCreate = useHasPermission('apiKey:create')
  const canUpdate = useHasPermission('apiKey:update')
  const canDelete = useHasPermission('apiKey:delete')

  const apiKeys = (data as unknown as ApiKey[] | null) ?? []

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = React.useCallback(() => {
    setEditingKey(null)
    setSheetOpen(true)
  }, [])

  const handleEdit = React.useCallback((key: ApiKey) => {
    setEditingKey(key)
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback((key: ApiKey) => {
    setDeletingKey(key)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingKey) return
    await deleteApiKey.mutateAsync(deletingKey.id)
    setDeleteDialogOpen(false)
    setDeletingKey(null)
  }, [deletingKey, deleteApiKey])

  async function handleSubmit(values: Record<string, unknown>) {
    if (editingKey) {
      const input: UpdateApiKeyInput & { id: string } = {
        id: editingKey.id,
        ...(values as UpdateApiKeyInput),
      }
      await updateApiKey.mutateAsync(input)
    } else {
      const result = await createApiKey.mutateAsync(
        values as unknown as CreateApiKeyInput,
      )
      const resultRecord = result as unknown as Record<string, unknown>
      const secret = resultRecord.key as string | undefined
      if (secret) {
        setNewKeySecret(secret)
      }
    }
    setSheetOpen(false)
    setEditingKey(null)
  }

  // ─── Table Columns ─────────────────────────────────────────

  const columns = React.useMemo<ColumnDef<ApiKey>[]>(
    () => [
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
          <div className="flex flex-col max-w-[180px] sm:max-w-[300px]">
            <span
              className="font-medium text-foreground truncate"
              title={row.original.name ?? undefined}
            >
              {row.original.name ?? 'Tanpa nama'}
            </span>
            <MaskedKey
              prefix={row.original.prefix}
              start={row.original.start}
            />
          </div>
        ),
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => {
          const isExpired =
            row.original.expiresAt &&
            new Date(row.original.expiresAt) < new Date()
          const isActive = row.original.enabled && !isExpired

          return (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
              />
              {isExpired ? 'Kedaluwarsa' : isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          )
        },
      },
      {
        accessorKey: 'rateLimitMax',
        header: 'Rate Limit',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatRateLimit(
              row.original.rateLimitMax,
              row.original.rateLimitTimeWindow,
            )}
          </span>
        ),
      },
      {
        accessorKey: 'lastRequest',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Terakhir Digunakan
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
          <span className="text-sm text-muted-foreground">
            {formatTimeAgo(row.original.lastRequest)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-2 group"
          >
            Dibuat
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
          const date = new Date(row.original.createdAt)
          return (
            <span className="text-muted-foreground text-sm">
              {date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 sm:opacity-40 transition-opacity group-hover/row:opacity-100">
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => handleEdit(row.original)}
                title="Edit API key"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit API key</span>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => handleDeleteClick(row.original)}
                title="Hapus API key"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Hapus API key</span>
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, canUpdate, canDelete],
  )

  const table = useReactTable({
    data: apiKeys,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    manualSorting: true,
    state: { sorting },
  })

  // ─── Render ────────────────────────────────────────────────

  return (
    <>
      {/* New Key Secret Banner */}
      {newKeySecret && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                API Key berhasil dibuat!
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                Salin key di bawah ini sekarang. Anda tidak akan bisa melihatnya
                lagi setelah ini.
              </p>
              <code className="block mt-2 text-sm font-mono bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-lg text-emerald-900 dark:text-emerald-100 break-all select-all">
                {newKeySecret}
              </code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 dark:text-emerald-300 shrink-0"
              onClick={() => setNewKeySecret(null)}
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* Page Header & Toolbar */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              API Keys
            </h2>
            <p className="text-muted-foreground text-base mt-2 max-w-xl leading-relaxed">
              Kelola API key untuk mengakses API BearUang secara terprogram.
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={handleCreate}
              size="lg"
              className="shadow-sm hover:shadow-md transition-all active:scale-95 sm:w-auto w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Buat API Key
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
        <Table className="w-full min-w-[500px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/40 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
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
                        className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse"
                        style={{ animationDuration: '3s' }}
                      />
                      <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 shadow-sm backdrop-blur-sm">
                        <KeyRound
                          className="h-9 w-9 text-emerald-500 animate-bounce"
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
                        <span className="inline-block text-emerald-900 dark:text-emerald-100">
                          Memuat daftar API key
                        </span>
                        <span className="inline-flex gap-0.5 ml-0.5 text-emerald-500">
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
                        Tunggu sebentar ya, kami sedang mengambil data API key
                        Anda 🐻
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
                    Aduh, gagal memuat daftar API key.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-[300px] mx-auto text-balance">
                    Sepertinya ada sedikit kendala jaringan. Mari kita coba
                    sekali lagi.
                  </p>
                  <Button
                    variant="outline"
                    className="px-6"
                    onClick={() => window.location.reload()}
                  >
                    Coba Muat Ulang
                  </Button>
                </TableCell>
              </TableRow>
            ) : apiKeys.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-24 whitespace-normal"
                >
                  <div className="flex flex-col items-center justify-center w-full max-w-full text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="relative mb-10 group cursor-default">
                      <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-colors duration-700" />

                      <div className="relative flex items-center justify-center">
                        <div className="absolute -top-6 -left-2 h-6 w-6 text-emerald-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-3 group-hover:-rotate-12 transition-all duration-700 delay-100">
                          <Sparkles className="h-full w-full" />
                        </div>
                        <div className="absolute bottom-0 -right-8 h-5 w-5 text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-500 delay-200">
                          <Sparkles className="h-full w-full" />
                        </div>

                        <div className="relative z-10 h-28 w-28 rounded-2xl bg-linear-to-br from-background to-emerald-50/80 dark:to-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shadow-md group-hover:shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer">
                          <KeyRound
                            className="h-12 w-12 text-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                            strokeWidth={1.5}
                          />
                        </div>
                      </div>
                    </div>

                    <h3 className="text-2xl font-semibold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-500 whitespace-normal">
                      Belum ada API key nih!{' '}
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-[420px] mx-auto text-balance whitespace-normal mb-8 leading-relaxed">
                      Buat API key pertama Anda untuk mulai mengakses API
                      BearUang secara terprogram.
                    </p>
                    {canCreate && (
                      <Button
                        onClick={handleCreate}
                        size="lg"
                        className="px-8 h-12 text-base shadow-sm hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
                      >
                        <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative flex items-center font-medium">
                          <Plus className="mr-2 h-5 w-5" />
                          Buat API Key Pertama
                        </span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors duration-200"
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

      {/* Create / Edit Sheet */}
      <ApiKeyFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingKey(null)
        }}
        apiKey={editingKey}
        onSubmit={handleSubmit}
        isPending={createApiKey.isPending || updateApiKey.isPending}
        mode={editingKey ? 'edit' : 'create'}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus API key?"
        description={
          <>
            Anda akan menghapus API key{' '}
            <span className="font-medium text-foreground">
              {deletingKey?.name ?? 'Tanpa nama'}
            </span>
            . Semua aplikasi yang menggunakan key ini akan kehilangan akses
            secara permanen.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteApiKey.isPending}
        confirmLabel="Ya, Hapus API Key"
      />
    </>
  )
}
