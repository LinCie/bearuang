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
import { PendingComponent } from '@/components/ui/pending-component'
import { signIn } from '@/lib/auth-client'
import { sessionQueryOptions } from '@/lib/session'
import { useState } from 'react'

export const Route = createFileRoute('/signin')({
  ssr: false,
  pendingComponent: PendingComponent,
  beforeLoad: async ({ context }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: SigninPage,
})

const emailSchema = z
  .string()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid')
const passwordSchema = z.string().min(1, 'Kata sandi wajib diisi')

function SigninPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { error } = await signIn.email({
        email: value.email,
        password: value.password,
        rememberMe: value.rememberMe,
      })
      if (error) {
        setServerError(error.message ?? 'Terjadi kesalahan. Coba lagi.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      await queryClient.fetchQuery(sessionQueryOptions)
      await router.invalidate()
      router.navigate({ to: '/' })
    },
  })

  return (
    <AuthLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-1.5 tracking-tight">
          Selamat datang kembali
        </h2>
        <p className="text-sm text-muted-foreground">
          Masuk ke akun Anda untuk melanjutkan.
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
                Email
              </Label>
              <Input
                id={field.name}
                type="email"
                placeholder="nama@perusahaan.com"
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

        {/* Password */}
        <form.Field
          name="password"
          validators={{ onBlur: passwordSchema, onSubmit: passwordSchema }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label
                  htmlFor={field.name}
                  className="block font-medium text-foreground"
                >
                  Kata Sandi
                </Label>

                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Lupa?
                </button>
              </div>
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

        {/* Remember Me */}
        <form.Field name="rememberMe">
          {(field) => (
            <div className="flex items-center gap-2 pt-1 pb-2">
              <Checkbox
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(Boolean(checked))
                }
                className="w-4 h-4 rounded border-input text-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
              <Label
                htmlFor={field.name}
                className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
              >
                Ingat saya di perangkat ini
              </Label>
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
              {isSubmitting ? 'Memproses...' : 'Masuk'}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Belum memiliki akun?{' '}
          <Link
            to="/signup"
            className="text-foreground font-semibold hover:underline decoration-2 underline-offset-4 transition-[text-decoration-color]"
          >
            Daftar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
