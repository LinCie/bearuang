import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState, ColumnDef } from '@tanstack/react-table'

import { Plus, Pencil, Trash2, KeyRound, Copy, Check } from 'lucide-react'
import { Button } from '#components/ui/button'
import { DataTable } from '#components/ui/data-table'
import { SortableHeader } from '#components/ui/sortable-header'

import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  ApiKeyFormSheet,
  DeleteDialog,
} from '#modules/api-keys/index'
import type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '#modules/api-keys/index'
import { useHasPermission } from '#lib/use-permissions'

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

function ApiKeysPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingKey, setEditingKey] = React.useState<ApiKey | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingKey, setDeletingKey] = React.useState<ApiKey | null>(null)

  const [newKeySecret, setNewKeySecret] = React.useState<string | null>(null)

  const { data, isLoading, isError } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const updateApiKey = useUpdateApiKey()
  const deleteApiKey = useDeleteApiKey()

  const canCreate = useHasPermission('apiKey:create')
  const canUpdate = useHasPermission('apiKey:update')
  const canDelete = useHasPermission('apiKey:delete')

  const apiKeys = (data as unknown as ApiKey[] | null) ?? []

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

  const columns = React.useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} title="Nama" />,
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
          <SortableHeader column={column} title="Terakhir Digunakan" />
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
          <SortableHeader column={column} title="Dibuat" />
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

  return (
    <>
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

      <DataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        loadingState={{
          icon: KeyRound,
          title: 'Memuat daftar API key',
          description:
            'Tunggu sebentar ya, kami sedang mengambil data API key Anda',
          iconClassName: 'text-emerald-500',
        }}
        errorState={{
          title: 'Aduh, gagal memuat daftar API key.',
          description:
            'Sepertinya ada sedikit kendala jaringan. Mari kita coba sekali lagi.',
          onRetry: () => window.location.reload(),
        }}
        emptyState={{
          icon: KeyRound,
          title: 'Belum ada API key nih!',
          description:
            'Buat API key pertama Anda untuk mulai mengakses API BearUang secara terprogram.',
          ...(canCreate && {
            action: {
              label: 'Buat API Key Pertama',
              onClick: handleCreate,
              icon: Plus,
            },
          }),
        }}
      />

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
