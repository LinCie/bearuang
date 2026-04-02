import { createFileRoute, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { Mail, Phone } from 'lucide-react'
import {
  useCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  CustomerDetailHeader,
  CustomerFormSheet,
  CustomerLoadingState,
  CustomerErrorState,
  DeleteDialog,
} from '#modules/customers/index'
import type { UpdateCustomerInput } from '#modules/customers/index'
import { useHasPermission } from '#lib/use-permissions'

export const Route = createFileRoute('/_dashboard/customers/$customerId')({
  component: CustomerDetailPage,
})

// ─── Utilities ────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'Baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`
  if (diffHours < 24) return `${diffHours} jam yang lalu`
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return `${diffDays} hari yang lalu`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`
  return `${Math.floor(diffDays / 30)} bulan yang lalu`
}

// ─── Page Component ───────────────────────────────────────────

function CustomerDetailPage() {
  const { customerId } = Route.useParams()
  const router = useRouter()
  const { data: customer, isLoading, isError } = useCustomer(customerId)

  // Mutations
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const canUpdate = useHasPermission('customer:update')

  // Edit sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  // ─── Handlers ──────────────────────────────────────────────

  const handleEdit = React.useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleDeleteClick = React.useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!customer) return
    await deleteCustomer.mutateAsync(customer.id)
    setDeleteDialogOpen(false)
    router.navigate({ to: '/customers' })
  }, [customer, deleteCustomer, router])

  const handleSubmit = React.useCallback(
    async (values: {
      name: string
      email: string
      phone: string
      address: string
      isActive: boolean
    }) => {
      if (!customer) return
      const input: UpdateCustomerInput & { id: string } = {
        id: customer.id,
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        isActive: values.isActive,
      }
      await updateCustomer.mutateAsync(input)
      setSheetOpen(false)
    },
    [customer, updateCustomer],
  )

  // ─── Loading State ─────────────────────────────────────────

  if (isLoading) {
    return <CustomerLoadingState />
  }

  // ─── Error State ───────────────────────────────────────────

  if (isError || !customer) {
    return <CustomerErrorState />
  }

  const customerData = customer

  // ─── Main Render ───────────────────────────────────────────

  return (
    <>
      <main className="flex flex-col gap-8 lg:gap-10 mt-6 mb-20 mx-auto">
        {/* Header Section */}
        <CustomerDetailHeader
          customer={customerData}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

        {/* Content Section */}
        <section className="flex flex-col gap-10 lg:pl-14">
          {/* Contact Information */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Kontak
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              {/* Email */}
              <div>
                <dt className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </dt>
                <dd className="text-sm text-foreground">
                  {customerData.email ? (
                    <a
                      href={`mailto:${customerData.email}`}
                      className="text-amber-700 hover:text-amber-800 hover:underline transition-colors"
                    >
                      {customerData.email}
                    </a>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-muted-foreground italic">
                        Belum ada email tercatat.
                      </span>
                      {canUpdate && (
                        <button
                          onClick={handleEdit}
                          className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                        >
                          Tambahkan email →
                        </button>
                      )}
                    </div>
                  )}
                </dd>
              </div>

              {/* Phone */}
              <div>
                <dt className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Telepon
                </dt>
                <dd className="text-sm text-foreground">
                  {customerData.phone ? (
                    <a
                      href={`tel:${customerData.phone}`}
                      className="text-amber-700 hover:text-amber-800 hover:underline transition-colors"
                    >
                      {customerData.phone}
                    </a>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-muted-foreground italic">
                        Belum ada telepon tercatat.
                      </span>
                      {canUpdate && (
                        <button
                          onClick={handleEdit}
                          className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                        >
                          Tambahkan telepon →
                        </button>
                      )}
                    </div>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Alamat Pelanggan
            </h2>
            {customerData.address ? (
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap max-w-3xl">
                {customerData.address}
              </p>
            ) : (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-muted-foreground text-sm">
                  Belum ada alamat tercatat untuk pelanggan ini.
                </p>
                {canUpdate && (
                  <button
                    onClick={handleEdit}
                    className="text-sm text-amber-700 hover:text-amber-800 font-medium self-start transition-colors"
                  >
                    Tambahkan alamat →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Informasi Pelanggan
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-2xl">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  ID Pelanggan
                </dt>
                <dd className="text-sm font-mono text-foreground/70">
                  {customerData.id.slice(0, 8)}...{customerData.id.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      customerData.isActive
                        ? 'bg-amber-100/70 text-amber-800 border border-amber-200/50'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        customerData.isActive ? 'bg-amber-500' : 'bg-stone-400'
                      }`}
                    />
                    {customerData.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Dibuat pada
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(customerData.createdAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-1">
                  Terakhir diperbarui
                </dt>
                <dd className="text-sm text-foreground">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(customerData.updatedAt))}
                  <span className="text-muted-foreground text-xs ml-2">
                    ({formatRelativeTime(customerData.updatedAt)})
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      {/* Edit Sheet */}
      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={customerData}
        onSubmit={handleSubmit}
        isPending={updateCustomer.isPending}
        mode="edit"
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus pelanggan?"
        description={
          <>
            Anda akan menghapus{' '}
            <span className="font-medium text-foreground">
              {customerData.name}
            </span>
            . Pelanggan ini akan dihapus secara permanen dan tidak bisa
            dikembalikan.
          </>
        }
        onConfirm={handleDeleteConfirm}
        isPending={deleteCustomer.isPending}
        confirmLabel="Ya, Hapus Pelanggan"
      />
    </>
  )
}
