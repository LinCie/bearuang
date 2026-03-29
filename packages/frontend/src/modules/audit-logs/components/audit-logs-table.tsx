import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  KeyRound,
  User,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuditLog } from '@/modules/audit-logs'

interface AuditLogsTableProps {
  logs: AuditLog[]
  sortBy: 'createdAt' | 'model' | 'operation'
  sortOrder: 'asc' | 'desc'
  onSort: (column: 'createdAt' | 'model' | 'operation') => void
}

function renderSortButton(
  column: 'createdAt' | 'model' | 'operation',
  label: string,
  sortBy: string,
  sortOrder: string,
  onSort: (col: 'createdAt' | 'model' | 'operation') => void,
) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
    >
      {label}
      {sortBy === column ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
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

export function AuditLogsTable({
  logs,
  sortBy,
  sortOrder,
  onSort,
}: AuditLogsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/40 dark:hover:bg-orange-950/20">
          <TableHead className="w-[160px]">
            {renderSortButton('createdAt', 'Waktu', sortBy, sortOrder, onSort)}
          </TableHead>
          <TableHead>
            {renderSortButton('model', 'Model', sortBy, sortOrder, onSort)}
          </TableHead>
          <TableHead>
            {renderSortButton(
              'operation',
              'Operasi',
              sortBy,
              sortOrder,
              onSort,
            )}
          </TableHead>
          <TableHead>Metode Auth</TableHead>
          <TableHead className="hidden lg:table-cell">Pengguna</TableHead>
          <TableHead className="hidden xl:table-cell">IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow
            key={log.id}
            className="border-border/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10"
          >
            <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
              {new Date(log.createdAt).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
                {log.model}
              </span>
            </TableCell>
            <TableCell>
              <OperationBadge operation={log.operation} />
            </TableCell>
            <TableCell>
              <AuthTypeBadge type={log.authType} />
            </TableCell>
            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
              {log.userId ? log.userId.slice(0, 8) + '...' : '—'}
            </TableCell>
            <TableCell className="hidden xl:table-cell text-sm text-muted-foreground tabular-nums">
              {log.ipAddress ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
