import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { User, Mail, Lock, Shield } from 'lucide-react'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { signUp } from '@/lib/auth-client'
import { useState } from 'react'

export const Route = createFileRoute('/signup')({
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

      router.navigate({ to: '/signin' })
    },
  })

  return (
    <AuthLayout>
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Buat Akun Baru
        </h2>
        <p className="text-muted-foreground">
          Isi detail di bawah untuk mendaftarkan bisnis Anda.
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {serverError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-center">
            {serverError}
          </p>
        )}

        {/* Full Name */}
        <form.Field
          name="name"
          validators={{ onBlur: nameSchema, onSubmit: nameSchema }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label
                htmlFor={field.name}
                className="block text-sm font-bold text-muted-foreground uppercase tracking-wider ml-4"
              >
                Nama Lengkap
              </Label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                <Input
                  id={field.name}
                  type="text"
                  placeholder="Budi Santoso"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                />
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive ml-4">
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
            <div className="space-y-2">
              <Label
                htmlFor={field.name}
                className="block text-sm font-bold text-muted-foreground uppercase tracking-wider ml-4"
              >
                Email Bisnis
              </Label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                <Input
                  id={field.name}
                  type="email"
                  placeholder="budi@bisnisanda.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                />
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive ml-4">
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
              <div className="space-y-2">
                <Label
                  htmlFor={field.name}
                  className="block text-sm font-bold text-muted-foreground uppercase tracking-wider ml-4"
                >
                  Kata Sandi
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                  <Input
                    id={field.name}
                    type="password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive ml-4">
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
              <div className="space-y-2">
                <Label
                  htmlFor={field.name}
                  className="block text-sm font-bold text-muted-foreground uppercase tracking-wider ml-4"
                >
                  Konfirmasi
                </Label>
                <div className="relative group">
                  <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                  <Input
                    id={field.name}
                    type="password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive ml-4">
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
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-4">
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(Boolean(checked))
                  }
                  className="w-5 h-5 rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <Label
                  htmlFor={field.name}
                  className="text-sm font-normal text-muted-foreground leading-tight cursor-pointer"
                >
                  Saya menyetujui{' '}
                  <a
                    href="#"
                    className="text-primary font-bold hover:underline"
                  >
                    Syarat &amp; Ketentuan
                  </a>{' '}
                  yang berlaku.
                </Label>
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive ml-4">
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
              className="w-full py-6 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isSubmitting ? 'Memproses...' : 'Daftar Sekarang'}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-muted-foreground pt-4">
          Sudah punya akun?{' '}
          <Link
            to="/signin"
            className="text-primary font-bold hover:underline decoration-2 underline-offset-4"
          >
            Masuk di sini
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
