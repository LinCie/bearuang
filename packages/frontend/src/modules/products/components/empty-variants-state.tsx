import { PackageOpen, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/lib/use-permissions'

interface EmptyVariantsStateProps {
  onCreate: () => void
}

export function EmptyVariantsState({ onCreate }: EmptyVariantsStateProps) {
  const canCreate = useHasPermission('product:create')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border/40 rounded-2xl mx-4 sm:mx-0 hover:border-amber-500/30 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-all duration-500 group cursor-default relative overflow-hidden">
      <div className="absolute inset-0 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors duration-700" />

      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute -top-4 -left-2 h-4 w-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 group-hover:-rotate-12 transition-all duration-700 delay-100">
          <Sparkles className="h-full w-full" />
        </div>
        <div className="absolute bottom-2 -right-4 h-3 w-3 text-orange-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 group-hover:scale-125 transition-all duration-500 delay-200">
          <Sparkles className="h-full w-full" />
        </div>

        <div className="relative z-10 h-16 w-16 rounded-2xl bg-linear-to-br from-background to-amber-50/80 dark:to-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-500 ease-out cursor-pointer">
          <PackageOpen
            className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors duration-500"
            strokeWidth={1.5}
          />
        </div>
      </div>

      <h3 className="text-lg font-medium text-foreground mb-2 group-hover:text-primary transition-colors duration-500 whitespace-normal">
        Belum ada varian 🐻
      </h3>
      <p className="text-muted-foreground text-sm max-w-[320px] text-center leading-relaxed mb-6 whitespace-normal">
        Apakah produk ini punya ukuran, rasa, atau warna yang berbeda? Yuk,
        tambahkan varian!
      </p>
      {canCreate && (
        <Button
          onClick={onCreate}
          className="shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden group/btn bg-linear-to-r from-primary to-primary/90 hover:from-primary hover:to-primary"
        >
          <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative flex items-center font-medium">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Varian Pertama
          </span>
        </Button>
      )}
    </div>
  )
}
