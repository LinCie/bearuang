import { PawPrint } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground antialiased min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between bg-muted/60 dark:bg-muted/10 border-r border-border/40 min-h-screen">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight hover:opacity-80 transition-opacity w-fit"
          >
            <PawPrint className="w-8 h-8" />
            <span>BearUang</span>
          </Link>
        </div>

        <div className="max-w-lg mb-12">
          <h1 className="text-[3.5rem] font-black text-foreground tracking-tight leading-[1.1] mb-6">
            Kelola bisnismu
            <br />
            <span className="text-primary font-medium opacity-90">
              dengan tenang.
            </span>
          </h1>
          <p className="text-muted-foreground text-xl leading-relaxed max-w-md">
            Sistem operasional bersih yang mengurangi kognitif bebanmu, bukan
            sebaliknya.
          </p>
        </div>

        <div className="text-sm font-medium text-muted-foreground/60">
          &copy; {new Date().getFullYear()} BearUang OMS.
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-24 bg-background relative z-10 w-full min-h-screen">
        <div className="absolute top-6 left-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight"
          >
            <PawPrint className="w-6 h-6" />
            <span>BearUang</span>
          </Link>
        </div>

        <div className="w-full max-w-[420px] mt-12 lg:mt-0">{children}</div>
      </main>
    </div>
  )
}
