import { createFileRoute, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import {
  User,
  Building2,
  Save,
  Lock,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
import {
  authClient,
  useSession,
  useActiveOrganization,
  useActiveMember,
} from '#lib/auth-client'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import { PasswordInput } from '#components/ui/password-input'
import { Skeleton } from '#components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#components/ui/alert-dialog'

export const Route = createFileRoute('/_dashboard/settings/')({
  component: SettingsPage,
})

// ─── Schemas ───────────────────────────────────────────────

const nameSchema = z
  .string()
  .min(1, 'Nama lengkap wajib diisi')
  .max(50, 'Nama terlalu panjang (maks. 50 karakter)')

const orgNameSchema = z
  .string()
  .min(1, 'Nama organisasi wajib diisi')
  .max(50, 'Nama terlalu panjang (maks. 50 karakter)')

const slugSchema = z
  .string()
  .min(1, 'Slug wajib diisi')
  .max(50, 'Slug terlalu panjang (maks. 50 karakter)')
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Gunakan huruf kecil, angka, dan tanda hubung saja',
  )

const currentPasswordSchema = z
  .string()
  .min(1, 'Masukkan kata sandi saat ini untuk memverifikasi')

const newPasswordSchema = z.string().min(8, 'Kata sandi minimal 8 karakter')

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

// ─── Read-only Field ───────────────────────────────────────

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-1.5 min-w-0 p-3 -mx-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
      <p
        className="text-sm text-foreground truncate"
        title={value || undefined}
      >
        {value || '-'}
      </p>
    </div>
  )
}

// ─── User Profile Section ──────────────────────────────────

function UserProfileSection() {
  const { data: sessionData } = useSession()
  const router = useRouter()
  const queryClient = router.options.context.queryClient

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  )

  const form = useForm({
    defaultValues: {
      name: sessionData?.user.name ?? '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSuccessMessage(null)

      const { error } = await authClient.updateUser({
        name: value.name,
      })

      if (error) {
        setServerError(
          error.message ?? 'Gagal memperbarui profil. Silakan coba lagi.',
        )
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['session'] })
      setSuccessMessage('Profil Anda kini tampil dengan wajah baru ✨')
    },
  })

  if (!sessionData) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <span className="text-sm text-muted-foreground animate-pulse">
            Menyiapkan ruang kendali Anda...
          </span>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Profil</h3>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {serverError && (
          <div className="text-sm text-destructive border border-destructive rounded-lg px-4 py-3 font-medium bg-background animate-in slide-in-from-top-1 fade-in duration-200">
            {serverError}
          </div>
        )}

        {successMessage && (
          <div className="text-sm text-primary border border-primary/30 rounded-lg px-4 py-3 font-medium bg-primary/5 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
            <Check className="w-4 h-4 shrink-0 animate-in zoom-in spin-in-12 duration-500 text-primary" />
            {successMessage}
          </div>
        )}

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
                Nama lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id={field.name}
                type="text"
                maxLength={50}
                placeholder="Mis. Budi Santoso"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Email</Label>
          <p className="text-sm text-foreground">{sessionData.user.email}</p>
        </div>

        <div className="pt-2">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSubmitting ? 'Menyimpan profil...' : 'Simpan profil'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Change Password Section ───────────────────────────────

function ChangePasswordSection() {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  )

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSuccessMessage(null)

      if (value.newPassword !== value.confirmPassword) {
        setServerError(
          'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.',
        )
        return
      }

      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })

      if (error) {
        setServerError(
          error.message ??
            'Gagal mengubah kata sandi. Pastikan kata sandi saat ini benar.',
        )
        return
      }

      form.reset()
      setSuccessMessage('Kata sandi telah diamankan 🔒')
    },
  })

  return (
    <section className="space-y-6 pt-6 border-t border-border/40">
      <div>
        <h3 className="text-lg font-medium text-foreground">Kata Sandi</h3>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {serverError && (
          <div className="text-sm text-destructive border border-destructive rounded-lg px-4 py-3 font-medium bg-background animate-in slide-in-from-top-1 fade-in duration-200">
            {serverError}
          </div>
        )}

        {successMessage && (
          <div className="text-sm text-primary border border-primary/30 rounded-lg px-4 py-3 font-medium bg-primary/5 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
            <Check className="w-4 h-4 shrink-0 animate-in zoom-in spin-in-12 duration-500 text-primary" />
            {successMessage}
          </div>
        )}

        <form.Field
          name="currentPassword"
          validators={{
            onBlur: currentPasswordSchema,
            onSubmit: currentPasswordSchema,
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                Kata sandi saat ini <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                id={field.name}
                placeholder="Ketik kata sandi saat ini"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="newPassword"
          validators={{
            onBlur: newPasswordSchema,
            onSubmit: newPasswordSchema,
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                Kata sandi baru <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                id={field.name}
                placeholder="Ketik kata sandi baru"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              <div className="flex flex-col gap-1.5 mt-1">
                {field.state.meta.errors[0] && (
                  <p
                    id={`${field.name}-error`}
                    className="text-xs text-destructive font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                  >
                    {/* @ts-expect-error type inconsistency */}
                    {field.state.meta.errors[0].message ||
                      field.state.meta.errors[0]}
                  </p>
                )}
                {field.state.value &&
                  field.state.value.length < 8 &&
                  !field.state.meta.errors[0] && (
                    <p className="text-xs text-muted-foreground font-medium animate-in fade-in">
                      {field.state.value.length}/8 karakter
                    </p>
                  )}
              </div>
            </div>
          )}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            onSubmit: ({ value }) => {
              const newPassword = form.getFieldValue('newPassword')
              if (value !== newPassword) {
                return 'Kata sandi tidak cocok'
              }
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                Ketik ulang kata sandi baru{' '}
                <span className="text-destructive">*</span>
              </Label>
              <PasswordInput
                id={field.name}
                placeholder="Ulangi kata sandi baru"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <div className="pt-2">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {isSubmitting ? 'Memperbarui sandi...' : 'Perbarui kata sandi'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Organization Info Section ─────────────────────────────

function OrganizationInfoSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: org, isPending } = useActiveOrganization()
  const router = useRouter()
  const queryClient = router.options.context.queryClient

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  )
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false)

  const form = useForm({
    defaultValues: {
      name: org?.name ?? '',
      slug: org?.slug ?? '',
      logo: org?.logo ?? '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSuccessMessage(null)

      const { error } = await authClient.organization.update({
        data: {
          name: value.name,
          slug: value.slug,
          logo: value.logo || undefined,
        },
      })

      if (error) {
        setServerError(
          error.message ?? 'Gagal memperbarui organisasi. Silakan coba lagi.',
        )
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['session'] })
      setSuccessMessage('Wajah organisasi berhasil disegarkan 🚀')
    },
  })

  React.useEffect(() => {
    if (org && !slugManuallyEdited) {
      form.setFieldValue('name', org.name)
      form.setFieldValue('slug', org.slug)
      form.setFieldValue('logo', org.logo ?? '')
    }
  }, [org?.id])

  if (isPending) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-44" />
          <span className="text-sm text-muted-foreground animate-pulse">
            Menyusun data organisasi...
          </span>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Organisasi</h3>
        </div>
        <div className="space-y-4">
          <ReadOnlyField label="Nama organisasi" value={org?.name} />
          <ReadOnlyField label="Slug (URL)" value={org?.slug} />
          <ReadOnlyField label="URL Logo" value={org?.logo} />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Organisasi</h3>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {serverError && (
          <div className="text-sm text-destructive border border-destructive rounded-lg px-4 py-3 font-medium bg-background animate-in slide-in-from-top-1 fade-in duration-200">
            {serverError}
          </div>
        )}

        {successMessage && (
          <div className="text-sm text-primary border border-primary/30 rounded-lg px-4 py-3 font-medium bg-primary/5 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
            <Check className="w-4 h-4 shrink-0 animate-in zoom-in spin-in-12 duration-500 text-primary" />
            {successMessage}
          </div>
        )}

        <form.Field
          name="name"
          validators={{ onBlur: orgNameSchema, onSubmit: orgNameSchema }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                Nama organisasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id={field.name}
                type="text"
                maxLength={50}
                placeholder="Mis. PT Sukses Makmur"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  if (!slugManuallyEdited) {
                    form.setFieldValue('slug', slugify(e.target.value))
                  }
                }}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

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
                URL pendek (Slug) <span className="text-destructive">*</span>
              </Label>
              <Input
                id={field.name}
                type="text"
                maxLength={50}
                placeholder="mis. sukses-makmur"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  setSlugManuallyEdited(true)
                  field.handleChange(slugify(e.target.value))
                }}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0] ? `${field.name}-error` : undefined
                }
              />
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="logo">
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                URL Logo
              </Label>
              <Input
                id={field.name}
                type="url"
                placeholder="https://contoh.com/logo.png"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors[0]}
                aria-describedby={
                  field.state.meta.errors[0]
                    ? `${field.name}-error`
                    : `${field.name}-description`
                }
              />
              <p
                id={`${field.name}-description`}
                className="text-xs text-muted-foreground"
              >
                Opsional. Berikan sentuhan personal dengan logo organisasi Anda.
              </p>
              {field.state.meta.errors[0] && (
                <p
                  id={`${field.name}-error`}
                  className="text-xs text-destructive mt-1 font-medium animate-in slide-in-from-top-1 fade-in duration-200"
                >
                  {/* @ts-expect-error type inconsistency */}
                  {field.state.meta.errors[0].message ||
                    field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <div className="pt-2">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSubmitting ? 'Menyimpan organisasi...' : 'Simpan organisasi'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}

// ─── Danger Zone Section ───────────────────────────────────

function DangerZoneSection() {
  const router = useRouter()
  const queryClient = router.options.context.queryClient
  const { data: org } = useActiveOrganization()
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const handleDelete = async () => {
    if (!org) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const { error } = await authClient.organization.delete({
        organizationId: org.id,
      })

      if (error) {
        setDeleteError(
          error.message ??
            'Gagal menghapus. Pastikan Anda memiliki hak akses yang sesuai.',
        )
        setIsDeleting(false)
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['session'] })
      router.navigate({ to: '/organizations' })
    } catch {
      setDeleteError('Terjadi kesalahan jaringan. Silakan coba lagi nanti.')
      setIsDeleting(false)
    }
  }

  return (
    <section className="space-y-6 pt-6 mt-6 border-t border-border/40">
      <div>
        <h3 className="text-lg font-medium text-destructive">
          Hapus Organisasi
        </h3>
        <p className="text-sm text-muted-foreground mt-1 text-balance">
          Tindakan ini akan menghapus organisasi dan semua data di dalamnya
          secara permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
      </div>
      <div>
        {deleteError && (
          <div className="text-sm text-destructive border border-destructive rounded-lg px-4 py-3 font-medium bg-background mb-4 animate-in slide-in-from-top-1 fade-in duration-200">
            {deleteError}
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={isDeleting}
              className="group"
            >
              <Trash2 className="w-4 h-4 mr-2 transition-transform group-hover:rotate-12" />
              Hapus Organisasi
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Trash2 className="w-8 h-8 text-destructive" />
              </AlertDialogMedia>
              <AlertDialogTitle>
                Hapus organisasi secara permanen?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Organisasi{' '}
                <span className="font-medium text-foreground">{org?.name}</span>{' '}
                beserta seluruh data produk, gudang, dan anggota akan dihapus.
                Anda tidak akan bisa mengembalikannya.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting
                  ? 'Menghapus organisasi...'
                  : 'Ya, hapus organisasi ini'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  )
}

// ─── Main Page ─────────────────────────────────────────────

function SettingsPage() {
  const { data: activeMember } = useActiveMember()
  const isAdmin =
    activeMember?.role === 'owner' || activeMember?.role === 'admin'

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-semibold text-foreground tracking-tight">
          Pengaturan
        </h2>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="profile"
        orientation="vertical"
        className="flex flex-col lg:flex-row gap-8 lg:gap-16 w-full"
      >
        <TabsList className="flex flex-row lg:flex-col justify-start gap-1 p-0 h-auto bg-transparent w-full lg:w-48 xl:w-56 shrink-0 overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="profile"
            className="justify-start px-3 py-2 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=inactive]:hover:bg-muted/60 transition-colors rounded-md whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <User className="w-4 h-4 mr-2" />
            Profil Saya
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="justify-start px-3 py-2 text-base font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=inactive]:hover:bg-muted/60 transition-colors rounded-md whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Organisasi
          </TabsTrigger>
        </TabsList>

        {/* User Profile Tab */}
        <TabsContent
          value="profile"
          className="flex-1 mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
        >
          <div className="flex flex-col gap-8 lg:gap-12 max-w-2xl">
            <UserProfileSection />
            <ChangePasswordSection />
          </div>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent
          value="organization"
          className="flex-1 mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
        >
          <div className="flex flex-col gap-8 lg:gap-12 max-w-2xl">
            <OrganizationInfoSection isAdmin={isAdmin} />
            {isAdmin && <DangerZoneSection />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
