import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  PawPrint,
  Plus,
  ArrowRight,
  TreePine,
  Mail,
  Check,
  X,
  Shield,
  Crown,
  Users,
} from 'lucide-react'
import { authClient, useListOrganizations } from '#lib/auth-client'
import { sessionQueryOptions } from '#lib/session'
import { PendingComponent } from '#components/ui/pending-component'
import { AuthLayout } from '#components/layouts/auth-layout'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import { Separator } from '#components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '#components/ui/sheet'
import {
  useMyPendingInvitations,
  useAcceptInvitation,
  useRejectInvitation,
} from '#modules/members/index'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#components/ui/dialog'
import { cn } from '#lib/utils'

export const Route = createFileRoute('/organizations')({
  pendingComponent: PendingComponent,
  beforeLoad: async ({ context, location }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions)

    if (!session) {
      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      })
    }
  },
  component: OrganizationsPage,
})

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const nameSchema = z
  .string()
  .min(1, 'Nama organisasi wajib diisi')
  .max(50, 'Maksimal 50 karakter')
const slugSchema = z
  .string()
  .min(1, 'Slug wajib diisi')
  .max(50, 'Maksimal 50 karakter')
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Slug hanya boleh huruf kecil, angka, dan tanda hubung',
  )

function OrganizationsPage() {
  const router = useRouter()
  const queryClient = router.options.context.queryClient
  const {
    data: organizations,
    isPending,
    error: organizationsError,
  } = useListOrganizations()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false)

  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
      metadata: {
        description: '',
        businessType: '',
      },
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const metadata: Record<string, string> = {}
      if (value.metadata.description) {
        metadata.description = value.metadata.description
      }
      if (value.metadata.businessType) {
        metadata.businessType = value.metadata.businessType
      }
      const { data: org, error } = await authClient.organization.create({
        name: value.name,
        slug: value.slug,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
      if (error) {
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
        return
      }
      await authClient.organization.setActive({ organizationId: org.id })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      await queryClient.fetchQuery(sessionQueryOptions)
      await router.invalidate()
      setSheetOpen(false)
      router.navigate({ to: '/' })
    },
  })

  const [selectingOrgId, setSelectingOrgId] = React.useState<string | null>(
    null,
  )

  // Pending invitations state
  const { data: pendingInvitationsData, isPending: invitationsLoading } =
    useMyPendingInvitations()
  const acceptInvitation = useAcceptInvitation()
  const rejectInvitation = useRejectInvitation()
  const [processingInvitationId, setProcessingInvitationId] = React.useState<
    string | null
  >(null)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectingInvitation, setRejectingInvitation] = React.useState<{
    id: string
    organizationName?: string
  } | null>(null)

  const pendingInvitations = pendingInvitationsData?.data ?? []
  const hasPendingInvitations = pendingInvitations.length > 0

  const handleAcceptInvitation = async (invitationId: string) => {
    if (processingInvitationId) return
    setProcessingInvitationId(invitationId)
    try {
      await acceptInvitation.mutateAsync(invitationId)
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      await queryClient.fetchQuery(sessionQueryOptions)
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch {
      setProcessingInvitationId(null)
    }
  }

  const handleRejectClick = (invitation: {
    id: string
    organizationName?: string
  }) => {
    setRejectingInvitation(invitation)
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectingInvitation) return
    await rejectInvitation.mutateAsync(rejectingInvitation.id)
    setRejectDialogOpen(false)
    setRejectingInvitation(null)
  }

  const handleSelectOrganization = async (organizationId: string) => {
    if (selectingOrgId) return
    setSelectingOrgId(organizationId)
    try {
      await authClient.organization.setActive({ organizationId })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      await queryClient.fetchQuery(sessionQueryOptions)
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch {
      setSelectingOrgId(null)
    }
  }

  const hasOrganizations = organizations && organizations.length > 0

  return (
    <AuthLayout>
      <div className="mb-8 flex flex-row items-center justify-between gap-4 overflow-hidden py-1">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-[both]">
          <h2 className="text-2xl font-bold text-foreground mb-1.5 tracking-tight flex items-center gap-2">
            {hasOrganizations ? 'Selamat datang kembali' : 'Petualangan Baru'}
            <TreePine
              aria-hidden="true"
              className="w-6 h-6 text-primary animate-in zoom-in spin-in-12 duration-700 ease-out delay-200 fill-mode-[both]"
            />
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasOrganizations
              ? 'Pilih ruang kerja Anda untuk melanjutkan.'
              : 'Mari bangun sesuatu yang hebat bersama.'}
          </p>
        </div>
        {hasOrganizations && (
          <Button
            variant="outline"
            className="shrink-0 group shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 active:shadow-none animate-in fade-in slide-in-from-right-4 duration-500 ease-out delay-150 fill-mode-[both] transition-all"
            onClick={() => setSheetOpen(true)}
          >
            <Plus
              aria-hidden="true"
              className="w-4 h-4 mr-2 group-hover:rotate-90 group-hover:text-primary transition-all duration-300"
            />
            Ruang Kerja Baru
          </Button>
        )}
      </div>

      {/* Pending Invitations Section */}
      {invitationsLoading ? (
        <div className="mb-8 p-5 rounded-xl border border-border bg-card/50 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
              >
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/4 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : hasPendingInvitations ? (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-[both]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-800/30 flex items-center justify-center shadow-sm">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Undangan Masuk
              </h3>
              <p className="text-sm text-muted-foreground">
                Anda memiliki {pendingInvitations.length} undangan{' '}
                {pendingInvitations.length === 1 ? 'menunggu' : 'menunggu'}{' '}
                respons
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingInvitations.map((invitation, index) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                index={index}
                isProcessing={processingInvitationId === invitation.id}
                onAccept={() => handleAcceptInvitation(invitation.id)}
                onReject={() => handleRejectClick({ id: invitation.id })}
                disabled={
                  processingInvitationId !== null ||
                  acceptInvitation.isPending ||
                  rejectInvitation.isPending
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {isPending ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Mempersiapkan sarang..."
          role="status"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full flex flex-col gap-4 p-5 rounded-xl border border-border bg-card/50"
            >
              <div
                className="w-12 h-12 rounded-lg bg-muted animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
              <div className="space-y-2 w-full">
                <div
                  className="h-5 w-1/2 bg-muted rounded animate-pulse"
                  style={{ animationDelay: `${i * 150 + 50}ms` }}
                />
                <div
                  className="h-3 w-1/3 bg-muted rounded animate-pulse"
                  style={{ animationDelay: `${i * 150 + 100}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : organizationsError ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 relative overflow-hidden">
          <div className="w-12 h-12 bg-destructive/10 dark:bg-destructive/20 text-destructive rounded-full flex items-center justify-center mb-4 relative z-10">
            <span className="text-2xl" aria-hidden="true">
              🌧️
            </span>
          </div>
          <h3 className="text-lg font-semibold text-destructive mb-2 relative z-10">
            Hujan mengganggu koneksi
          </h3>
          <p className="text-sm text-destructive/80 max-w-sm mb-6 relative z-10">
            Kelihatannya kami kehilangan jejak saat mencoba memuat ruang kerja
            Anda. Boleh coba sekali lagi?
          </p>
          <Button
            variant="outline"
            className="relative z-10 hover:bg-destructive/10 border-destructive/20 text-destructive"
            onClick={() => window.location.reload()}
          >
            Muat Ulang Halaman
          </Button>
        </div>
      ) : hasOrganizations ? (
        <div className="flex flex-col gap-4">
          {organizations.map((org, index) => (
            <button
              key={org.id}
              type="button"
              disabled={selectingOrgId !== null}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleSelectOrganization(org.id)}
              className="group relative w-full flex flex-col items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-linear-to-br hover:from-primary/5 hover:to-transparent cursor-pointer transition-all duration-300 ease-out text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 active:translate-y-0 hover:shadow-md active:shadow-xs active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 fill-mode-[both]"
            >
              <div className="w-12 h-12 shrink-0 rounded-lg border border-border bg-background shadow-xs text-foreground flex items-center justify-center text-sm font-semibold uppercase group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 ease-out group-hover:border-primary">
                {Array.from(org.name)[0] || '?'}
              </div>
              <div className="space-y-1 w-full relative">
                <span className="font-medium text-lg text-foreground truncate block pr-8 transition-colors group-hover:text-primary">
                  {org.name}
                </span>
                <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground/70">
                  Ketuk untuk membuka
                </span>

                {selectingOrgId !== org.id ? (
                  <ArrowRight
                    className="w-5 h-5 absolute right-0 top-1/2 -translate-y-1/2 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl bg-linear-to-br from-primary/5 via-background to-transparent border border-primary/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />
          <div className="relative w-20 h-20 bg-background border border-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3 group-hover:rotate-12 transition-transform duration-500 ease-out">
            <PawPrint aria-hidden="true" className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3 relative">
            Ruang Kosong Menanti
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-8 relative leading-relaxed">
            Kanvas Anda sudah siap. Buat ruang kerja pertama Anda dan mulai
            cerita perjalanan kesuksesan organisasi Anda.
          </p>
          <Button
            size="lg"
            className="relative font-semibold shadow-md hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:scale-95 active:shadow-none transition-all duration-300 ease-out group/btn"
            onClick={() => setSheetOpen(true)}
          >
            <Plus
              aria-hidden="true"
              className="w-5 h-5 mr-2 group-hover/btn:rotate-90 transition-transform duration-300"
            />
            Bangun Ruang Kerja Pertama
          </Button>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            form.reset()
            setSlugManuallyEdited(false)
            setServerError(null)
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2">
              <TreePine className="w-6 h-6 text-primary" aria-hidden="true" />
              Mulai Sesuatu
            </SheetTitle>
            <SheetDescription className="text-base text-muted-foreground">
              Beri nama pada ruang kerja kayu Anda yang baru. Anda bisa
              mengganti ini kapan saja nanti.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-col gap-4 px-4"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            {serverError && (
              <div className="text-sm text-destructive border border-destructive rounded-lg px-4 py-3 font-medium bg-background">
                {serverError}
              </div>
            )}

            {/* Name */}
            <form.Field
              name="name"
              validators={{ onBlur: nameSchema, onSubmit: nameSchema }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={field.name}
                    className="block font-medium text-foreground"
                  >
                    Nama Organisasi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    maxLength={50}
                    placeholder="Contoh: Kebun Beruang"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      if (!slugManuallyEdited) {
                        form.setFieldValue('slug', slugify(e.target.value))
                      }
                    }}
                    className="transition-all duration-300 hover:border-primary/30 focus:bg-primary/5"
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive mt-1 font-medium">
                      {field.state.meta.errors[0].message}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Slug */}
            <form.Field
              name="slug"
              validators={{ onBlur: slugSchema, onSubmit: slugSchema }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={field.name}
                    className="block font-medium text-foreground"
                  >
                    Slug <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    maxLength={50}
                    placeholder="kebun-beruang"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      setSlugManuallyEdited(true)
                      field.handleChange(slugify(e.target.value))
                    }}
                    className="transition-all duration-300 hover:border-primary/30 focus:bg-primary/5"
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive mt-1 font-medium">
                      {field.state.meta.errors[0].message}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <div className="flex flex-col gap-2 pt-2">
              <Separator />
              <h4 className="text-sm font-medium text-foreground mt-2">
                Informasi Tambahan (Opsional)
              </h4>
            </div>

            {/* Metadata: Business Type */}
            <form.Field name="metadata.businessType">
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={field.name}
                    className="block font-medium text-foreground"
                  >
                    Jenis Bisnis
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    maxLength={50}
                    placeholder="Contoh: Retail, Kuliner, Jasa"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Metadata: Description */}
            <form.Field name="metadata.description">
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={field.name}
                    className="block font-medium text-foreground"
                  >
                    Deskripsi
                  </Label>
                  <textarea
                    id={field.name}
                    maxLength={200}
                    placeholder="Deskripsi singkat organisasi (opsional)"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>
              )}
            </form.Field>
          </form>

          <SheetFooter>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <div className="flex w-full gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={isSubmitting}
                    onClick={() => setSheetOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1 transition-transform active:scale-95"
                    disabled={isSubmitting}
                    onClick={() => form.handleSubmit()}
                  >
                    {isSubmitting ? 'Membuat...' : 'Buat'}
                  </Button>
                </div>
              )}
            </form.Subscribe>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reject Invitation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" />
              Tolak Undangan?
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Anda akan menolak undangan untuk bergabung dengan organisasi ini.
              Tindakan ini tidak dapat dibatalkan, namun Anda dapat menerima
              undangan baru di kemudian hari.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectInvitation.isPending}
            >
              Kembali
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectInvitation.isPending}
            >
              {rejectInvitation.isPending
                ? 'Memproses...'
                : 'Ya, Tolak Undangan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  )
}

// ─── Invitation Card Component ─────────────────────────────────

interface InvitationCardProps {
  invitation: {
    id: string
    organizationId: string
    organizationName?: string
    email: string
    role: string | null
    status: string
    createdAt: string
  }
  index: number
  isProcessing: boolean
  onAccept: () => void
  onReject: () => void
  disabled: boolean
}

const roleConfig = {
  owner: {
    label: 'Pemilik',
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
  },
  member: {
    label: 'Anggota',
    icon: Users,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50 border-border',
  },
} as const

function getRoleConfig(role: string | null) {
  if (!role) return roleConfig.member
  if (role in roleConfig) {
    return roleConfig[role as keyof typeof roleConfig]
  }
  // Custom role
  return {
    label: role,
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40',
  }
}

function InvitationCard({
  invitation,
  index,
  isProcessing,
  onAccept,
  onReject,
  disabled,
}: InvitationCardProps) {
  const config = getRoleConfig(invitation.role)
  const Icon = config.icon
  const date = new Date(invitation.createdAt)
  const orgInitial = invitation.organizationName
    ? Array.from(invitation.organizationName)[0].toUpperCase()
    : '?'

  return (
    <div
      className={cn(
        'group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-300',
        'bg-gradient-to-r from-amber-50/40 via-background to-orange-50/30',
        'dark:from-amber-950/20 dark:via-background dark:to-orange-950/10',
        'border-amber-200/50 dark:border-amber-800/30',
        'hover:border-amber-300/60 dark:hover:border-amber-700/40',
        'hover:shadow-sm',
        disabled && 'opacity-60 pointer-events-none',
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="shrink-0">
        <div
          className={cn(
            'w-11 h-11 rounded-lg flex items-center justify-center text-sm font-semibold uppercase',
            'bg-gradient-to-br from-amber-100 to-orange-100',
            'dark:from-amber-900/30 dark:to-orange-900/20',
            'border border-amber-200/60 dark:border-amber-800/30',
            'text-amber-700 dark:text-amber-300',
            'shadow-sm',
          )}
        >
          {orgInitial}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">
            {invitation.organizationName ?? 'Organisasi Baru'}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border',
              config.bg,
              config.color,
            )}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            Dikirim{' '}
            {date.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={disabled}
          className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
        >
          <X className="w-4 h-4 mr-1.5" />
          Tolak
        </Button>
        <Button
          size="sm"
          onClick={onAccept}
          disabled={disabled}
          className={cn(
            'bg-gradient-to-r from-amber-600 to-orange-600',
            'hover:from-amber-700 hover:to-orange-700',
            'text-white shadow-sm hover:shadow transition-all',
            'disabled:opacity-70',
          )}
        >
          {isProcessing ? (
            <div className="w-4 h-4 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-1.5" />
          )}
          {isProcessing ? 'Memproses...' : 'Terima'}
        </Button>
      </div>
    </div>
  )
}
