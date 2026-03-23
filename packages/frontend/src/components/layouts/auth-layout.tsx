import { ShieldCheck, Zap } from 'lucide-react'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground antialiased min-h-screen flex flex-col">
      <main className="grow flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side: Editorial Content */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-4">
              <span className="inline-block px-4 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold tracking-widest uppercase">
                Mulai Petualanganmu
              </span>
              <h1 className="text-6xl font-extrabold text-primary tracking-tight leading-tight">
                Kelola Keuangan dengan Hangat.
              </h1>
              <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
                Bergabunglah dengan ribuan pengusaha yang telah menyederhanakan
                operasional bisnis mereka dengan BearUang OMS.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-6 rounded-lg space-y-2">
                <ShieldCheck className="text-primary w-8 h-8" />
                <h3 className="font-bold text-foreground">Keamanan Terjamin</h3>
                <p className="text-sm text-muted-foreground">
                  Data bisnis Anda aman dalam enkripsi berlapis.
                </p>
              </div>
              <div className="bg-muted p-6 rounded-lg space-y-2">
                <Zap className="text-primary w-8 h-8" />
                <h3 className="font-bold text-foreground">Proses Cepat</h3>
                <p className="text-sm text-muted-foreground">
                  Sistem yang ringan dan responsif untuk Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Form Card */}
          <div className="bg-card rounded-xl p-8 md:p-12 shadow-lg border border-border">
            {children}
          </div>
        </div>
      </main>

      {/* Visual Background Elements */}
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary/30 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="fixed top-[10%] right-[-5%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
    </div>
  )
}
