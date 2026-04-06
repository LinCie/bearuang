import { X } from 'lucide-react'

export interface PastedContent {
  id: string
  content: string
}

interface PastedContentCardProps {
  content: PastedContent
  onRemove: (id: string) => void
}

export const PastedContentCard = ({
  content,
  onRemove,
}: PastedContentCardProps) => {
  return (
    <div className="relative group shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-bg-300 bg-bg-000 dark:bg-bg-100 animate-fade-in p-3 flex flex-col justify-between shadow-[0_1px_2px_rgba(139,90,43,0.06)]">
      <div className="overflow-hidden w-full">
        <p className="text-[10px] text-text-400 leading-[1.4] font-mono wrap-break-word whitespace-pre-wrap line-clamp-4 select-none">
          {content.content}
        </p>
      </div>

      <div className="flex items-center w-full mt-2">
        <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-accent/15 bg-accent/5 dark:bg-accent/10">
          <span className="text-[9px] font-bold text-text-300 dark:text-text-300 uppercase tracking-wider font-sans">
            TEKS
          </span>
        </div>
      </div>

      <button
        onClick={() => onRemove(content.id)}
        className="absolute top-2 right-2 p-0.75 bg-bg-100 dark:bg-bg-200 border border-bg-300 rounded-full text-text-400 hover:text-text-300 dark:hover:text-text-100 transition-colors shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-text-100"
        aria-label="Hapus teks yang ditempel"
      >
        <X className="w-2 h-2" />
      </button>
    </div>
  )
}
