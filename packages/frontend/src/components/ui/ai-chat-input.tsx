import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { PastedContentCard } from './pasted-content-card'
import type { PastedContent } from './pasted-content-card'

const MAX_TEXTAREA_HEIGHT = 384
const PASTE_LENGTH_THRESHOLD = 300
const MAX_PASTED_CLIPS = 5

interface AiChatInputProps {
  isLoading?: boolean
  onSendMessage: (data: {
    message: string
    pastedContent: PastedContent[]
  }) => void
}

export const AiChatInput = ({
  isLoading = false,
  onSendMessage,
}: AiChatInputProps) => {
  const [message, setMessage] = useState('')
  const [pastedContent, setPastedContent] = useState<PastedContent[]>([])

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'
    }
  }, [message])

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (
      text.length >= PASTE_LENGTH_THRESHOLD &&
      pastedContent.length < MAX_PASTED_CLIPS
    ) {
      e.preventDefault()
      const snippet: PastedContent = {
        id: crypto.randomUUID(),
        content: text,
      }
      setPastedContent((prev) => [...prev, snippet])
    }
  }

  const handleSend = () => {
    if (!message.trim() && pastedContent.length === 0) return
    onSendMessage({ message, pastedContent })
    setMessage('')
    setPastedContent([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = message.trim() || pastedContent.length > 0
  const isDisabled = isLoading || !hasContent

  return (
    <div
      data-chat-input
      className="relative w-full max-w-2xl mx-auto font-sans"
    >
      <div
        className={`
          box-content! flex flex-col mx-2 md:mx-0 items-stretch transition-all duration-200 relative z-10 rounded-2xl cursor-text border border-bg-300 dark:border-bg-300/20
          shadow-[0_1px_3px_rgba(139,90,43,0.06)] hover:shadow-[0_1px_6px_rgba(139,90,43,0.09)]
          focus-within:shadow-[0_0_0_2px_rgba(217,119,87,0.15),0_1px_8px_rgba(139,90,43,0.1)]
          bg-bg-000 dark:bg-bg-200 font-sans antialiased
        `}
      >
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          {pastedContent.length > 0 && (
            <div
              className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1"
              aria-live="polite"
              aria-label="Teks yang ditempel"
            >
              {pastedContent.map((content) => (
                <PastedContentCard
                  key={content.id}
                  content={content}
                  onRemove={(id) =>
                    setPastedContent((prev) => prev.filter((c) => c.id !== id))
                  }
                />
              ))}
            </div>
          )}

          <div className="relative mb-1">
            <div className="max-h-96 w-full overflow-y-auto custom-scrollbar font-sans wrap-break-word transition-opacity duration-200 min-h-10 pl-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                placeholder="Cari produk, buat variant, cek stok..."
                aria-label="Tulis pesan ke asisten"
                disabled={isLoading}
                maxLength={2000}
                className="w-full bg-transparent border-0 outline-none text-text-100 text-[16px] placeholder:text-text-300/70 resize-none overflow-hidden py-0 leading-relaxed block font-normal antialiased disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
                style={{ minHeight: '1.5em' }}
              />
            </div>
          </div>

          <div className="flex gap-2 w-full items-center justify-end">
            <button
              onClick={handleSend}
              disabled={isDisabled}
              className={`
                inline-flex items-center justify-center relative shrink-0 transition-colors h-8 w-8 rounded-xl active:scale-95 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2
                ${
                  !isDisabled
                    ? 'bg-accent text-bg-0 hover:bg-accent-hover shadow-md'
                    : 'bg-accent/30 text-bg-0/60 cursor-default'
                }
              `}
              type="button"
              aria-label="Kirim pesan"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AiChatInput
