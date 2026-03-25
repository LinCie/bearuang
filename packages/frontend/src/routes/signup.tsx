import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { signUp } from '@/lib/auth-client'
import { sessionQueryOptions } from '@/lib/session'
import { useState } from 'react'

export const Route = createFileRoute('/signup')({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: SignupPage,
})

const nameSchema = z.string().min(2, 'Nama minimal 2 karakter')
const emailSchema = z
  .string()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid')
const passwordSchema = z.string().min(8, 'Kata sandi minimal 8 karakter')
const confirmPasswordSchema = z
  .string()
  .min(1, 'Konfirmasi kata sandi wajib diisi')
const termsSchema = z
  .boolean()
  .refine((v) => v === true, 'Anda harus menyetujui Syarat & Ketentuan')

function SignupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)

      if (value.password !== value.confirmPassword) {
        setServerError('Kata sandi tidak cocok.')
        return
      }

      const { error } = await signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
      })

      if (error) {
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
        return
      }

      await queryClient.fetchQuery(sessionQueryOptions)
      router.navigate({ to: '/signin' })
    },
  })

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-1.5 tracking-tight">
          Buat akun baru
        </h2>
        <p className="text-sm text-muted-foreground">
          Isi detail di bawah untuk mendaftarkan bisnis Anda.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {serverError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 text-center font-medium">
            {serverError}
          </p>
        )}

        {/* Full Name */}
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
                Nama Lengkap
              </Label>
              <Input
                id={field.name}
                type="text"
                placeholder="Budi Santoso"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-12 px-4 bg-transparent border-input rounded-lg focus-visible:ring-1"
              />
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  {field.state.meta.errors[0].message}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Email */}
        <form.Field
          name="email"
          validators={{ onBlur: emailSchema, onSubmit: emailSchema }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label
                htmlFor={field.name}
                className="block font-medium text-foreground"
              >
                Email Bisnis
              </Label>
              <Input
                id={field.name}
                type="email"
                placeholder="budi@bisnisanda.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-12 px-4 bg-transparent border-input rounded-lg focus-visible:ring-1"
              />
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  {field.state.meta.errors[0].message}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Password Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form.Field
            name="password"
            validators={{ onBlur: passwordSchema, onSubmit: passwordSchema }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label
                  htmlFor={field.name}
                  className="block font-medium text-foreground"
                >
                  Kata Sandi
                </Label>
                <PasswordInput
                  id={field.name}
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive mt-1 font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="confirmPassword"
            validators={{
              onBlur: confirmPasswordSchema,
              onSubmit: confirmPasswordSchema,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label
                  htmlFor={field.name}
                  className="block font-medium text-foreground"
                >
                  Konfirmasi
                </Label>
                <PasswordInput
                  id={field.name}
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive mt-1 font-medium">
                    {field.state.meta.errors[0].message}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </div>

        {/* Terms */}
        <form.Field name="acceptedTerms" validators={{ onSubmit: termsSchema }}>
          {(field) => (
            <div className="space-y-1 pt-1 pb-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(Boolean(checked))
                  }
                  className="w-4 h-4 mt-0.5 rounded border-input text-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
                <Label
                  htmlFor={field.name}
                  className="text-sm font-medium text-muted-foreground leading-snug cursor-pointer select-none"
                >
                  Saya menyetujui{' '}
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="text-foreground font-semibold hover:underline decoration-1 underline-offset-2"
                  >
                    Syarat &amp; Ketentuan
                  </button>
                </Label>
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive mt-1 font-medium ml-6">
                  {field.state.meta.errors[0].message}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Submit */}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full h-12 rounded-lg font-semibold text-base transition-colors duration-300"
            >
              {isSubmitting ? 'Memproses...' : 'Daftar Sekarang'}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Sudah punya akun?{' '}
          <Link
            to="/signin"
            className="text-foreground font-semibold hover:underline decoration-2 underline-offset-4 transition-[text-decoration-color]"
          >
            Masuk
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
