import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#lib/api'
import { AiChatInput } from '#components/ui/ai-chat-input'
import type { PastedContent } from '#components/ui/pasted-content-card'
import {
  MessageSquare,
  Check,
  X,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  Package,
  Tags,
  Truck,
  ShoppingCart,
  Warehouse,
  Users,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import Markdown from 'react-markdown'

export const Route = createFileRoute('/_dashboard/chat/')({
  component: ChatPage,
})

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface PendingConfirmation {
  reply: string
  pendingActions: Array<{ tool: string; args: Record<string, unknown> }>
}

const SUGGESTED_PROMPTS = [
  { label: 'Cari produk kopi', icon: Search, message: 'Cari produk kopi' },
  { label: 'Buat produk baru', icon: Plus, message: 'Buat produk baru' },
  {
    label: 'Lihat daftar kategori',
    icon: Tags,
    message: 'Tampilkan semua kategori produk',
  },
  {
    label: 'Cek stok variant',
    icon: Package,
    message: 'Tampilkan variant dan stok produk',
  },
  {
    label: 'Cari supplier',
    icon: Truck,
    message: 'Cari supplier',
  },
  {
    label: 'Buat purchase order',
    icon: ShoppingCart,
    message: 'Buat purchase order baru',
  },
  {
    label: 'Lihat gudang',
    icon: Warehouse,
    message: 'Tampilkan daftar gudang',
  },
  {
    label: 'Buat gudang baru',
    icon: Warehouse,
    message: 'Buat gudang baru',
  },
  {
    label: 'Cari pelanggan',
    icon: Users,
    message: 'Cari pelanggan',
  },
  {
    label: 'Buat pelanggan baru',
    icon: Users,
    message: 'Buat pelanggan baru',
  },
  {
    label: 'Cari sales order',
    icon: Receipt,
    message: 'Cari sales order',
  },
  {
    label: 'Buat sales order',
    icon: Receipt,
    message: 'Buat sales order baru',
  },
] as const

const TOOL_LABELS: Record<string, string> = {
  search_products: 'Cari Produk',
  get_product: 'Detail Produk',
  create_product: 'Buat Produk',
  update_product: 'Update Produk',
  delete_product: 'Hapus Produk',
  restore_product: 'Pulihkan Produk',
  list_categories: 'Daftar Kategori',
  get_category: 'Detail Kategori',
  create_category: 'Buat Kategori',
  update_category: 'Update Kategori',
  delete_category: 'Hapus Kategori',
  restore_category: 'Pulihkan Kategori',
  get_product_variants: 'Variant Produk',
  create_variant: 'Buat Variant',
  update_variant: 'Update Variant',
  delete_variant: 'Hapus Variant',
  search_suppliers: 'Cari Supplier',
  get_supplier: 'Detail Supplier',
  create_supplier: 'Buat Supplier',
  update_supplier: 'Update Supplier',
  delete_supplier: 'Hapus Supplier',
  search_purchase_orders: 'Cari Purchase Order',
  get_purchase_order: 'Detail Purchase Order',
  create_purchase_order: 'Buat Purchase Order',
  update_purchase_order: 'Update Purchase Order',
  receive_purchase_order: 'Terima Barang PO',
  delete_purchase_order: 'Hapus Purchase Order',
  list_warehouses: 'Daftar Gudang',
  get_warehouse: 'Detail Gudang',
  create_warehouse: 'Buat Gudang',
  update_warehouse: 'Update Gudang',
  delete_warehouse: 'Hapus Gudang',
  search_customers: 'Cari Pelanggan',
  get_customer: 'Detail Pelanggan',
  create_customer: 'Buat Pelanggan',
  update_customer: 'Update Pelanggan',
  delete_customer: 'Hapus Pelanggan',
  restore_customer: 'Pulihkan Pelanggan',
  search_sales_orders: 'Cari Sales Order',
  get_sales_order: 'Detail Sales Order',
  create_sales_order: 'Buat Sales Order',
  update_sales_order: 'Update Sales Order',
  delete_sales_order: 'Hapus Sales Order',
}

function humanizeTool(tool: string): string {
  return TOOL_LABELS[tool] ?? tool
}

function flattenArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
    )
    .join('\n')
}

function ChatPage() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [pendingConfirmation, setPendingConfirmation] =
    React.useState<PendingConfirmation | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [actionResults, setActionResults] = React.useState<
    Array<{
      tool: string
      success: boolean
      data?: unknown
      error?: { code: string; message: string }
    }>
  >([])

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [scrollTrigger, setScrollTrigger] = React.useState(0)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [scrollTrigger])

  function bumpScroll() {
    setScrollTrigger((n) => n + 1)
  }

  function handleApiError(err: unknown) {
    const errMsg =
      err instanceof Error
        ? err.message
        : 'Gagal menghubungi asisten AI. Periksa koneksi internet Anda.'
    setError(errMsg)
    toast.error(errMsg)
  }

  async function postChat(
    userMsg: ChatMessage,
    confirmedWriteTools?: string[],
  ) {
    const historySlice = messages.slice(-20)

    const { data: responseData, error: responseError } = await api.ai.chat.post(
      {
        message: userMsg.content,
        messages: historySlice,
        ...(confirmedWriteTools ? { confirmedWriteTools } : {}),
      },
    )

    if (responseError) {
      const errBody = responseError as { error?: string }
      const errMsg = errBody.error ?? 'Gagal menghubungi asisten AI. Coba lagi.'
      setError(errMsg)
      toast.error(errMsg)
      return
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: responseData.reply,
    }

    if (responseData.type === 'confirmation_required') {
      setPendingConfirmation({
        reply: responseData.reply,
        pendingActions: responseData.pendingActions,
      })
    } else if (responseData.type === 'action_result') {
      setActionResults(responseData.actionResults)
      setMessages((prev) => [...prev, assistantMsg])
    } else {
      setMessages((prev) => [...prev, assistantMsg])
    }
  }

  function resetState() {
    setIsLoading(true)
    setError(null)
    setPendingConfirmation(null)
    setActionResults([])
  }

  async function handleSendMessage(data: {
    message: string
    pastedContent: PastedContent[]
  }) {
    const { message, pastedContent } = data
    const fullMessage =
      pastedContent.length > 0
        ? `${message}\n\n${pastedContent.map((p) => p.content).join('\n\n')}`
        : message

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: fullMessage,
    }
    setMessages((prev) => [...prev, userMsg])
    resetState()
    bumpScroll()

    try {
      await postChat(userMsg)
      bumpScroll()
    } catch (err) {
      handleApiError(err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleConfirm() {
    if (!pendingConfirmation) return

    const confirmedTools = pendingConfirmation.pendingActions.map((a) => a.tool)
    const confirmMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Ya, lanjutkan.',
    }

    // Add the AI's confirmation message to the history before user's response
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: pendingConfirmation.reply,
      },
      confirmMsg,
    ])
    resetState()
    bumpScroll()

    try {
      await postChat(confirmMsg, confirmedTools)
      bumpScroll()
    } catch (err) {
      handleApiError(err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    if (!pendingConfirmation) return
    setPendingConfirmation(null)
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: pendingConfirmation.reply,
      },
      { id: crypto.randomUUID(), role: 'user', content: 'Batal.' },
    ])
    bumpScroll()
  }

  return (
    <div className="relative -mx-4 md:-mx-10 -my-8 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between px-4 md:px-8 py-3 shrink-0 border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h1 className="text-xl font-bold text-primary/90">AI Assistant</h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4"
        role="log"
        aria-label="Riwayat percakapan"
        aria-busy={isLoading}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center select-none animate-fade-in px-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary/40 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-muted-foreground/80">
              Apa yang bisa saya bantu?
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() =>
                    handleSendMessage({
                      message: prompt.message,
                      pastedContent: [],
                    })
                  }
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground rounded-xl border border-border/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <prompt.icon className="w-3.5 h-3.5 shrink-0" />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
                msg.role === 'user'
                  ? 'whitespace-pre-wrap bg-primary text-primary-foreground rounded-2xl rounded-br-md ml-auto max-w-[80%] md:max-w-[60%]'
                  : 'bg-muted text-foreground rounded-2xl rounded-bl-md mr-auto max-w-[85%] md:max-w-[70%] text-[15px]'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert prose-p:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1.5 prose-headings:my-1 max-w-none">
                  <Markdown>{msg.content}</Markdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {pendingConfirmation && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 max-w-[80%] md:max-w-[60%] mr-auto">
              <div className="prose prose-sm dark:prose-invert prose-p:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1.5 prose-headings:my-1 max-w-none">
                <Markdown>{pendingConfirmation.reply}</Markdown>
              </div>
              <div className="space-y-2">
                {pendingConfirmation.pendingActions.map((action) => (
                  <div
                    key={action.tool}
                    className="text-sm text-muted-foreground rounded-lg bg-background/50 px-3 py-2"
                  >
                    <span className="font-medium text-foreground">
                      {humanizeTool(action.tool)}
                    </span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap wrap-break-word font-mono text-muted-foreground/80">
                      {flattenArgs(action.args)}
                    </pre>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Lanjutkan tindakan"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {humanizeTool(pendingConfirmation.pendingActions[0].tool)}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Batalkan tindakan"
                >
                  <X className="w-3.5 h-3.5" />
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {actionResults.length > 0 && (
          <div className="flex justify-start animate-fade-in ml-4 md:ml-8">
            <div className="space-y-1.5">
              {actionResults.map((result) => (
                <div
                  key={result.tool}
                  className="flex items-center gap-2 text-sm"
                >
                  {result.success ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="text-success font-medium">
                        {humanizeTool(result.tool)}
                      </span>
                      <span className="text-muted-foreground">Berhasil</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      <span className="text-destructive font-medium">
                        {humanizeTool(result.tool)}
                      </span>
                      <span className="text-destructive/70">
                        {result.error?.message ?? 'Gagal'}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-destructive/10 text-destructive max-w-[85%] md:max-w-[70%]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-muted text-foreground rounded-2xl rounded-bl-md mr-auto px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Beruang sedang berpikir...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <div className="shrink-0 border-t border-border/10 px-4 md:px-8 py-4">
        <AiChatInput isLoading={isLoading} onSendMessage={handleSendMessage} />
      </div>
    </div>
  )
}
