import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { purchaseOrdersService } from '#modules/purchase-orders/purchase-orders.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const purchaseOrderTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_purchase_orders',
      description:
        'Cari purchase order berdasarkan filter. Mengembalikan daftar purchase order dengan paginasi.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            format: 'enum',
            enum: [
              'PENDING',
              'CONFIRMED',
              'SHIPPED',
              'RECEIVED',
              'COMPLETED',
              'CANCELLED',
            ],
            description: 'Filter berdasarkan status purchase order.',
          },
          paymentStatus: {
            type: 'string',
            format: 'enum',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
            description: 'Filter berdasarkan status pembayaran.',
          },
          supplierId: {
            type: 'string',
            description: 'Filter berdasarkan ID supplier.',
          },
          warehouseId: {
            type: 'string',
            description: 'Filter berdasarkan ID gudang.',
          },
          page: {
            type: 'number',
            description: 'Nomor halaman (mulai dari 1). Default: 1.',
          },
          pageSize: {
            type: 'number',
            description: 'Jumlah item per halaman (maks 50). Default: 10.',
          },
          sortBy: {
            type: 'string',
            format: 'enum',
            enum: ['createdAt', 'updatedAt', 'orderedAt'],
            description: 'Urutkan berdasarkan field. Default: createdAt.',
          },
          sortOrder: {
            type: 'string',
            format: 'enum',
            enum: ['asc', 'desc'],
            description: 'Urutan pengurutan. Default: desc.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_purchase_order',
      description:
        'Ambil detail satu purchase order berdasarkan ID. Mengembalikan informasi lengkap termasuk item, supplier, dan gudang.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID purchase order' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_purchase_order',
      description:
        'Buat purchase order baru. Memerlukan supplierId, warehouseId, dan minimal satu item. Item harus memiliki variantId, quantity, dan unitCost.',
      parameters: {
        type: 'object',
        properties: {
          supplierId: {
            type: 'string',
            description: 'UUID supplier',
          },
          warehouseId: {
            type: 'string',
            description: 'UUID gudang tujuan',
          },
          orderedAt: {
            type: 'string',
            format: 'date',
            description: 'Tanggal order (ISO 8601). Default: sekarang.',
          },
          note: {
            type: 'string',
            description: 'Catatan untuk purchase order. Opsional.',
          },
          items: {
            type: 'array',
            description: 'Daftar item yang dipesan',
            items: {
              type: 'object',
              properties: {
                variantId: {
                  type: 'string',
                  description: 'UUID variant produk',
                },
                quantity: {
                  type: 'number',
                  description: 'Jumlah yang dipesan',
                },
                unitCost: {
                  type: 'number',
                  description: 'Harga satuan',
                },
              },
              required: ['variantId', 'quantity', 'unitCost'],
            },
          },
        },
        required: ['supplierId', 'warehouseId', 'items'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'update_purchase_order',
      description:
        'Update purchase order yang sudah ada. Hanya field yang diberikan yang akan diubah. Tidak bisa mengubah purchase order yang sudah COMPLETED atau CANCELLED.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID purchase order yang akan diupdate',
          },
          status: {
            type: 'string',
            format: 'enum',
            enum: [
              'PENDING',
              'CONFIRMED',
              'SHIPPED',
              'RECEIVED',
              'COMPLETED',
              'CANCELLED',
            ],
            description: 'Status baru. Harus mengikuti alur status yang valid.',
          },
          paymentStatus: {
            type: 'string',
            format: 'enum',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
            description: 'Status pembayaran baru.',
          },
          paymentMethod: {
            type: 'string',
            description: 'Metode pembayaran.',
          },
          amountPaid: {
            type: 'number',
            description: 'Jumlah yang dibayar (tambahan).',
          },
          supplierId: {
            type: 'string',
            description: 'UUID supplier baru.',
          },
          warehouseId: {
            type: 'string',
            description: 'UUID gudang baru.',
          },
          orderedAt: {
            type: 'string',
            format: 'date',
            description: 'Tanggal order baru (ISO 8601).',
          },
          note: {
            type: 'string',
            description: 'Catatan baru.',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'receive_purchase_order',
      description:
        'Terima barang dari purchase order. Memperbarui status menjadi RECEIVED dan menambah stok di gudang. Hanya bisa dilakukan untuk purchase order dengan status CONFIRMED atau SHIPPED.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID purchase order',
          },
          items: {
            type: 'array',
            description: 'Daftar item yang diterima',
            items: {
              type: 'object',
              properties: {
                itemId: {
                  type: 'string',
                  description: 'UUID item purchase order',
                },
                receivedQty: {
                  type: 'number',
                  description: 'Jumlah yang diterima',
                },
              },
              required: ['itemId', 'receivedQty'],
            },
          },
        },
        required: ['id', 'items'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'delete_purchase_order',
      description:
        'Hapus purchase order secara permanen. Hanya bisa menghapus purchase order dengan status PENDING.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID purchase order yang akan dihapus',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const purchaseOrderPermissions: Record<string, string> = {
  search_purchase_orders: 'purchaseOrder:view',
  get_purchase_order: 'purchaseOrder:view',
  create_purchase_order: 'purchaseOrder:create',
  update_purchase_order: 'purchaseOrder:update',
  receive_purchase_order: 'purchaseOrder:update',
  delete_purchase_order: 'purchaseOrder:delete',
}

export const purchaseOrderSystemPrompt = `
### Purchase Order
- **Mencari purchase order** — cari berdasarkan status, pembayaran, supplier, gudang
- **Melihat detail purchase order** — lihat info lengkap termasuk item, supplier, gudang
- **Membuat purchase order** — pesan barang dari supplier ke gudang
- **Mengupdate purchase order** — ubah status, pembayaran, dll
- **Menerima barang** — update status menjadi RECEIVED dan tambah stok
- **Menghapus purchase order** — hapus hanya jika status PENDING

**Alur Status Purchase Order**: PENDING → CONFIRMED → SHIPPED → RECEIVED → COMPLETED. Pembayaran bisa dilakukan kapan saja.
`

function buildPaginationArgs(args: Record<string, unknown>): {
  page: number
  pageSize: number
  skip: number
  sortBy: string
  sortOrder: string
} {
  const page = Math.max(1, Math.floor(Number(args.page) || 1))
  const pageSize = Math.min(
    Math.max(1, Math.floor(Number(args.pageSize) || 10)),
    50,
  )
  const skip = (page - 1) * pageSize
  const sortBy = (args.sortBy as string) ?? 'createdAt'
  const sortOrder = (args.sortOrder as string) ?? 'desc'
  return { page, pageSize, skip, sortBy, sortOrder }
}

function serializePurchaseOrder(po: {
  createdAt: Date
  updatedAt: Date
  orderedAt?: Date | null
  receivedAt?: Date | null
}): Record<string, unknown> {
  return {
    ...po,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    orderedAt: po.orderedAt?.toISOString() ?? null,
    receivedAt: po.receivedAt?.toISOString() ?? null,
  }
}

export const purchaseOrderHandlers: Record<string, ToolHandler> = {
  search_purchase_orders: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const { data, total } = await purchaseOrdersService.listPurchaseOrders(
      context.organizationId,
      {
        skip,
        take: pageSize,
        status: args.status as
          | 'PENDING'
          | 'CONFIRMED'
          | 'SHIPPED'
          | 'RECEIVED'
          | 'COMPLETED'
          | 'CANCELLED'
          | undefined,
        paymentStatus: args.paymentStatus as
          | 'UNPAID'
          | 'PARTIALLY_PAID'
          | 'PAID'
          | undefined,
        supplierId: args.supplierId as string | undefined,
        warehouseId: args.warehouseId as string | undefined,
        orderBy: {
          field: sortBy as 'createdAt' | 'updatedAt' | 'orderedAt',
          order: sortOrder as 'asc' | 'desc',
        },
      },
    )
    return JSON.stringify({
      success: true,
      data: data.map(serializePurchaseOrder),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_purchase_order: async (args, context) => {
    const purchaseOrder = await purchaseOrdersService.getPurchaseOrder(
      context.organizationId,
      args.id as string,
    )
    if (!purchaseOrder) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Purchase order tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: serializePurchaseOrder(purchaseOrder),
    })
  },

  create_purchase_order: async (args, context, params) => {
    const items =
      (args.items as Array<{
        variantId: string
        quantity: number
        unitCost: number
      }>) ?? []
    const purchaseOrder = await purchaseOrdersService.createPurchaseOrder(
      context.organizationId,
      {
        supplierId: args.supplierId as string,
        warehouseId: args.warehouseId as string,
        orderedAt: args.orderedAt
          ? new Date(args.orderedAt as string)
          : undefined,
        note: (args.note as string) ?? undefined,
        items,
      },
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'PurchaseOrder',
      operation: 'create',
      args: {
        data: {
          supplierId: args.supplierId,
          warehouseId: args.warehouseId,
          items: items.length,
        },
      },
    })
    return JSON.stringify({
      success: true,
      data: serializePurchaseOrder(purchaseOrder),
    })
  },

  update_purchase_order: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.status !== undefined) data.status = args.status
    if (args.paymentStatus !== undefined)
      data.paymentStatus = args.paymentStatus
    if (args.paymentMethod !== undefined)
      data.paymentMethod = args.paymentMethod
    if (args.amountPaid !== undefined) data.amountPaid = args.amountPaid
    if (args.supplierId !== undefined) data.supplierId = args.supplierId
    if (args.warehouseId !== undefined) data.warehouseId = args.warehouseId
    if (args.orderedAt !== undefined)
      data.orderedAt = new Date(args.orderedAt as string)
    if (args.note !== undefined) data.note = args.note
    const result = await purchaseOrdersService.updatePurchaseOrder(
      context.organizationId,
      args.id as string,
      data as Parameters<
        (typeof purchaseOrdersService)['updatePurchaseOrder']
      >[2],
    )
    if ('error' in result && result.error) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error,
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'PurchaseOrder',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Purchase order updated' },
    })
  },

  receive_purchase_order: async (args, context, params) => {
    const items =
      (args.items as Array<{
        itemId: string
        receivedQty: number
      }>) ?? []
    const result = await purchaseOrdersService.receivePurchaseOrder(
      context.organizationId,
      args.id as string,
      items,
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Purchase order tidak ditemukan',
        },
      })
    }
    if ('error' in result && result.error) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error,
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'PurchaseOrder',
      operation: 'receive',
      args: { id: args.id, items },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Purchase order received' },
    })
  },

  delete_purchase_order: async (args, context, params) => {
    const deleteResult = await purchaseOrdersService.deletePurchaseOrder(
      context.organizationId,
      args.id as string,
    )
    if (deleteResult && 'error' in deleteResult && deleteResult.error) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: deleteResult.error,
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'PurchaseOrder',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Purchase order deleted' },
    })
  },
}
