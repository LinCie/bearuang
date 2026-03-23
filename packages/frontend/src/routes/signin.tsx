import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { signIn } from '@/lib/auth-client'
import { useState } from 'react'

export const Route = createFileRoute('/signin')({
  component: SigninPage,
})

const emailSchema = z.string().min(1, 'Email wajib diisi').email('Format email tidak valid')
const passwordSchema = z.string().min(1, 'Kata sandi wajib diisi')

function SigninPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
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
      router.navigate({ to: '/' })
    },
  })

  return (
    <AuthLayout>
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-foreground mb-2">Selamat Datang</h2>
        <p className="text-muted-foreground">Silakan masuk ke akun BearUang Anda</p>
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
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                <Input
                  id={field.name}
                  type="email"
                  placeholder="nama@perusahaan.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                />
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive ml-4">{field.state.meta.errors[0].message}</p>
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
            <div className="space-y-2">
              <div className="flex justify-between items-center px-4">
                <Label
                  htmlFor={field.name}
                  className="block text-sm font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Kata Sandi
                </Label>
                <a href="#" className="text-xs font-bold text-primary hover:underline">
                  Lupa kata sandi?
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                <Input
                  id={field.name}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full bg-muted border-none rounded-full py-6 pl-14 pr-14 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors group-focus-within:text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {field.state.meta.errors[0] && (
                <p className="text-xs text-destructive ml-4">{field.state.meta.errors[0].message}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Remember Me */}
        <form.Field name="rememberMe">
          {(field) => (
            <div className="flex items-center gap-3 px-4">
              <Checkbox
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(Boolean(checked))}
                className="w-5 h-5 rounded border-muted-foreground text-primary focus:ring-primary"
              />
              <Label
                htmlFor={field.name}
                className="text-sm font-normal text-muted-foreground leading-tight cursor-pointer"
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
              className="w-full py-6 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isSubmitting ? 'Memproses...' : 'Masuk ke Dashboard'}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-muted-foreground pt-4">
          Belum memiliki akun?{' '}
          <Link
            to="/signup"
            className="text-primary font-bold hover:underline decoration-2 underline-offset-4"
          >
            Daftar di sini
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
