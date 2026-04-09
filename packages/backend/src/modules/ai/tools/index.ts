import type { ToolDefinition, ToolExecutor } from '#integrations/llm'
import type { ToolHandlerParams, ToolHandlerContext } from './types'
import {
  productTools,
  productHandlers,
  productPermissions,
  productSystemPrompt,
} from './products.ai'
import {
  categoryTools,
  categoryHandlers,
  categoryPermissions,
  categorySystemPrompt,
} from './categories.ai'
import {
  variantTools,
  variantHandlers,
  variantPermissions,
  variantSystemPrompt,
} from './variants.ai'
import {
  supplierTools,
  supplierHandlers,
  supplierPermissions,
  supplierSystemPrompt,
} from './suppliers.ai'
import {
  purchaseOrderTools,
  purchaseOrderHandlers,
  purchaseOrderPermissions,
  purchaseOrderSystemPrompt,
} from './purchase-orders.ai'
import {
  warehouseTools,
  warehouseHandlers,
  warehousePermissions,
  warehouseSystemPrompt,
} from './warehouses.ai'
import {
  customerTools,
  customerHandlers,
  customerPermissions,
  customerSystemPrompt,
} from './customers.ai'
import {
  salesOrderTools,
  salesOrderHandlers,
  salesOrderPermissions,
  salesOrderSystemPrompt,
} from './sales-orders.ai'

export * from './types'

export const allTools: ToolDefinition[] = [
  ...productTools,
  ...categoryTools,
  ...variantTools,
  ...supplierTools,
  ...purchaseOrderTools,
  ...warehouseTools,
  ...customerTools,
  ...salesOrderTools,
]

export const allHandlers: Record<
  string,
  (
    args: Record<string, unknown>,
    context: ToolHandlerContext,
    params: ToolHandlerParams,
  ) => Promise<string>
> = {
  ...productHandlers,
  ...categoryHandlers,
  ...variantHandlers,
  ...supplierHandlers,
  ...purchaseOrderHandlers,
  ...warehouseHandlers,
  ...customerHandlers,
  ...salesOrderHandlers,
}

export const toolPermissions: Record<string, string> = {
  ...productPermissions,
  ...categoryPermissions,
  ...variantPermissions,
  ...supplierPermissions,
  ...purchaseOrderPermissions,
  ...warehousePermissions,
  ...customerPermissions,
  ...salesOrderPermissions,
}

export const systemPrompt = `
Kamu adalah asisten manajemen inventaris produk yang membantu pengguna mengelola produk, variant, kategori, supplier, purchase order, gudang, pelanggan, dan sales order. Kamu sangat membantu, responsif, dan selalu memberikan informasi yang akurat.

## Kemampuan Kamu

Kamu dapat melakukan operasi berikut:

${productSystemPrompt}
${categorySystemPrompt}
${variantSystemPrompt}
${supplierSystemPrompt}
${purchaseOrderSystemPrompt}
${warehouseSystemPrompt}
${customerSystemPrompt}
${salesOrderSystemPrompt}

## Aturan Penting

1. **Operasi baca (cari, lihat, daftar)**: Langsung eksekusi tanpa konfirmasi.
2. **Operasi tulis (buat, update, hapus, pulihkan)**: Sistem akan secara otomatis mencegah eksekusi operasi tulis dan mengembalikan status "menunggu konfirmasi". **PENTING: Jangan pernah mengatakan operasi berhasil dilakukan sampai kamu melihat hasil tool yang menunjukkan success: true. Jika kamu menerima hasil tool dengan pending: true, jelaskan bahwa operasi menunggu konfirmasi pengguna.**
3. **Setelah konfirmasi**: Jika operasi tulis berhasil dieksekusi setelah konfirmasi (hasil tool menunjukkan success: true), laporkan hasilnya kepada pengguna. Jika gagal, jelaskan errornya.
4. **Tampilkan data dengan rapi** — gunakan daftar atau tabel yang mudah dibaca.
5. **Jika terjadi error izin**, jelaskan kepada pengguna bahwa mereka tidak memiliki izin yang diperlukan.
6. **Jika data tidak ditemukan**, informasikan kepada pengguna.
7. **Gunakan bahasa Indonesia** untuk semua respons.
8. **Slug otomatis** — jika pengguna tidak memberikan slug saat membuat produk atau kategori, slug akan dibuat otomatis dari nama.
9. **Purchase Order Flow** — status mengikuti alur: PENDING → CONFIRMED → SHIPPED → RECEIVED → COMPLETED. Pembayaran bisa dilakukan kapan saja.
10. **Menerima barang** — gunakan tool receive_purchase_order untuk menerima barang dari purchase order yang sudah dikirim.
11. **Sales Order Flow** — status mengikuti alur: PENDING → CONFIRMED → SHIPPED → DELIVERED → COMPLETED. Saat SHIPPED, stok otomatis berkurang.
12. **Pelanggan dan Tamu** — sales order bisa untuk pelanggan terdaftar (customerId) atau tamu (guestName).
`

export function buildExecuteTool(params: ToolHandlerParams): ToolExecutor {
  return async (toolName, args, context) => {
    const permission = toolPermissions[toolName]
    if (permission) {
      const allowed = await params.checkPermission(permission)
      if (!allowed) {
        return JSON.stringify({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Anda tidak memiliki izin untuk melakukan operasi ini.',
          },
        })
      }
    }

    const handler = allHandlers[toolName]
    if (!handler) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Unknown tool: ${toolName}`,
        },
      })
    }

    try {
      const result = await handler(args, context as ToolHandlerContext, params)
      return result
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data sudah digunakan. Pastikan SKU atau slug unik.',
          },
        })
      }
      const message = error instanceof Error ? error.message : 'Internal error'
      return JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      })
    }
  }
}
