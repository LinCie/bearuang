import type { SalesOrder } from '@/modules/sales-orders'

export const statusStyles: Record<SalesOrder['status'], string> = {
  PENDING: 'bg-muted text-muted-foreground border-muted-foreground/20',
  CONFIRMED:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  SHIPPED:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  DELIVERED:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  COMPLETED:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  CANCELLED:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

export const statusLabels: Record<SalesOrder['status'], string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Dikonfirmasi',
  SHIPPED: 'Dikirim',
  DELIVERED: 'Diterima',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

export const paymentStatusStyles: Record<SalesOrder['paymentStatus'], string> =
  {
    UNPAID:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    PARTIALLY_PAID:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    PAID: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
  }

export const paymentStatusLabels: Record<SalesOrder['paymentStatus'], string> =
  {
    UNPAID: 'Belum Bayar',
    PARTIALLY_PAID: 'Dibayar Sebagian',
    PAID: 'Lunas',
  }

export function StatusBadge({ status }: { status: SalesOrder['status'] }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

export function PaymentStatusBadge({
  status,
}: {
  status: SalesOrder['paymentStatus']
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${paymentStatusStyles[status]}`}
    >
      {paymentStatusLabels[status]}
    </span>
  )
}

export function LargeStatusBadge({ status }: { status: SalesOrder['status'] }) {
  return (
    <span
      className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

export function getStatusLabel(status: SalesOrder['status']): string {
  return statusLabels[status]
}

export function getPaymentStatusLabel(
  status: SalesOrder['paymentStatus'],
): string {
  return paymentStatusLabels[status]
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
