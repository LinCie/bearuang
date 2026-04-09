import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { salesOrdersService } from '#modules/sales-orders/sales-orders.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const salesOrderTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_sales_orders',
      description:
        'Cari sales order berdasarkan filter. Mengembalikan daftar sales order dengan paginasi.',
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
              'DELIVERED',
              'COMPLETED',
              'CANCELLED',
            ],
            description: 'Filter berdasarkan status sales order.',
          },
          paymentStatus: {
            type: 'string',
            format: 'enum',
            enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
            description: 'Filter berdasarkan status pembayaran.',
          },
          customerId: {
            type: 'string',
            description: 'Filter berdasarkan ID pelanggan.',
          },
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (note, nama tamu, email tamu)',
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
      name: 'get_sales_order',
      description:
        'Ambil detail satu sales order berdasarkan ID. Mengembalikan informasi lengkap termasuk item, pelanggan, dan gudang.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID sales order' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_sales_order',
      description:
        'Buat sales order baru. Memerlukan warehouseId dan minimal satu item. Pelanggan bisa dipilih (customerId) atau menggunakan data tamu (guestName).',
      parameters: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'UUID pelanggan (jika pelanggan terdaftar)',
          },
          guestName: {
            type: 'string',
            description: 'Nama tamu (jika bukan pelanggan terdaftar)',
          },
          guestEmail: {
            type: 'string',
            description: 'Email tamu. Opsional.',
          },
          warehouseId: {
            type: 'string',
            description: 'UUID gudang asal',
          },
          orderedAt: {
            type: 'string',
            format: 'date',
            description: 'Tanggal order (ISO 8601). Default: sekarang.',
          },
          note: {
            type: 'string',
            description: 'Catatan untuk sales order. Opsional.',
          },
          paymentMethod: {
            type: 'string',
            format: 'enum',
            enum: ['CASH', 'QRIS', 'TRANSFER', 'CARD'],
            description: 'Metode pembayaran. Jika diisi, order otomatis lunas.',
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
                unitPrice: {
                  type: 'number',
                  description: 'Harga satuan',
                },
              },
              required: ['variantId', 'quantity', 'unitPrice'],
            },
          },
        },
        required: ['warehouseId', 'items'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'update_sales_order',
      description:
        'Update sales order yang sudah ada. Hanya field yang diberikan yang akan diubah. Tidak bisa mengubah sales order yang sudah COMPLETED atau CANCELLED.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID sales order yang akan diupdate',
          },
          status: {
            type: 'string',
            format: 'enum',
            enum: [
              'PENDING',
              'CONFIRMED',
              'SHIPPED',
              'DELIVERED',
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
          customerId: {
            type: 'string',
            description: 'UUID pelanggan baru.',
          },
          warehouseId: {
            type: 'string',
            description: 'UUID gudang baru.',
          },
          guestName: {
            type: 'string',
            description: 'Nama tamu baru.',
          },
          guestEmail: {
            type: 'string',
            description: 'Email tamu baru.',
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
      name: 'delete_sales_order',
      description:
        'Hapus sales order secara permanen. Hanya bisa menghapus sales order dengan status PENDING atau CANCELLED.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID sales order yang akan dihapus',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const salesOrderPermissions: Record<string, string> = {
  search_sales_orders: 'salesOrder:view',
  get_sales_order: 'salesOrder:view',
  create_sales_order: 'salesOrder:create',
  update_sales_order: 'salesOrder:update',
  delete_sales_order: 'salesOrder:delete',
}

export const salesOrderSystemPrompt = `
### Sales Order
- **Mencari sales order** — cari berdasarkan status, pembayaran, pelanggan, gudang
- **Melihat detail sales order** — lihat info lengkap termasuk item, pelanggan, gudang
- **Membuat sales order** — jual barang dari gudang ke pelanggan atau tamu
- **Mengupdate sales order** — ubah status, pembayaran, dll
- **Menghapus sales order** — hapus hanya jika status PENDING atau CANCELLED

**Alur Status Sales Order**: PENDING → CONFIRMED → SHIPPED → DELIVERED → COMPLETED. Status CANCELLED bisa dari PENDING, CONFIRMED, atau SHIPPED.
**Catatan Penting**: Saat status berubah ke SHIPPED, stok otomatis berkurang. Jika dibatalkan dari SHIPPED, stok dikembalikan.
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

function serializeSalesOrder(so: {
  createdAt: Date
  updatedAt: Date
  orderedAt?: Date | null
  shippedAt?: Date | null
  amountPaid: { toString: () => string }
  items?: Array<{
    unitPrice: { toString: () => string }
  }>
}): Record<string, unknown> {
  return {
    ...so,
    createdAt: so.createdAt.toISOString(),
    updatedAt: so.updatedAt.toISOString(),
    orderedAt: so.orderedAt?.toISOString() ?? null,
    shippedAt: so.shippedAt?.toISOString() ?? null,
    amountPaid: so.amountPaid.toString(),
    items: so.items?.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
    })),
  }
}

export const salesOrderHandlers: Record<string, ToolHandler> = {
  search_sales_orders: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const { data, total } = await salesOrdersService.listSalesOrders(
      context.organizationId,
      {
        skip,
        take: pageSize,
        status: args.status as
          | 'PENDING'
          | 'CONFIRMED'
          | 'SHIPPED'
          | 'DELIVERED'
          | 'COMPLETED'
          | 'CANCELLED'
          | undefined,
        paymentStatus: args.paymentStatus as
          | 'UNPAID'
          | 'PARTIALLY_PAID'
          | 'PAID'
          | undefined,
        customerId: args.customerId as string | undefined,
        search: args.search as string | undefined,
        orderBy: {
          field: sortBy as 'createdAt' | 'updatedAt' | 'orderedAt',
          order: sortOrder as 'asc' | 'desc',
        },
      },
    )
    return JSON.stringify({
      success: true,
      data: data.map(serializeSalesOrder),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_sales_order: async (args, context) => {
    const salesOrder = await salesOrdersService.getSalesOrder(
      context.organizationId,
      args.id as string,
    )
    if (!salesOrder) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sales order tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: serializeSalesOrder(salesOrder),
    })
  },

  create_sales_order: async (args, context, params) => {
    const items =
      (args.items as Array<{
        variantId: string
        quantity: number
        unitPrice: number
      }>) ?? []
    const salesOrder = await salesOrdersService.createSalesOrder(
      context.organizationId,
      {
        customerId: (args.customerId as string) ?? undefined,
        guestName: (args.guestName as string) ?? undefined,
        guestEmail: (args.guestEmail as string) ?? undefined,
        warehouseId: args.warehouseId as string,
        orderedAt: args.orderedAt
          ? new Date(args.orderedAt as string)
          : undefined,
        note: (args.note as string) ?? undefined,
        paymentMethod: args.paymentMethod as
          | 'CASH'
          | 'QRIS'
          | 'TRANSFER'
          | 'CARD'
          | undefined,
        items,
      },
    )
    if ('error' in salesOrder && salesOrder.error) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: salesOrder.error,
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'SalesOrder',
      operation: 'create',
      args: {
        data: {
          customerId: args.customerId,
          guestName: args.guestName,
          warehouseId: args.warehouseId,
          items: items.length,
        },
      },
    })
    const so = salesOrder as Exclude<
      Awaited<ReturnType<typeof salesOrdersService.createSalesOrder>>,
      { error: string }
    >
    return JSON.stringify({
      success: true,
      data: {
        ...so,
        createdAt: so.createdAt.toISOString(),
        updatedAt: so.updatedAt.toISOString(),
        orderedAt: so.orderedAt?.toISOString() ?? null,
        shippedAt: so.shippedAt?.toISOString() ?? null,
        amountPaid: so.amountPaid.toString(),
        items: so.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
        })),
      },
    })
  },

  update_sales_order: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.status !== undefined) data.status = args.status
    if (args.paymentStatus !== undefined)
      data.paymentStatus = args.paymentStatus
    if (args.paymentMethod !== undefined)
      data.paymentMethod = args.paymentMethod
    if (args.amountPaid !== undefined) data.amountPaid = args.amountPaid
    if (args.customerId !== undefined) data.customerId = args.customerId
    if (args.warehouseId !== undefined) data.warehouseId = args.warehouseId
    if (args.guestName !== undefined) data.guestName = args.guestName
    if (args.guestEmail !== undefined) data.guestEmail = args.guestEmail
    if (args.orderedAt !== undefined)
      data.orderedAt = new Date(args.orderedAt as string)
    if (args.note !== undefined) data.note = args.note
    const result = await salesOrdersService.updateSalesOrder(
      context.organizationId,
      args.id as string,
      data as Parameters<(typeof salesOrdersService)['updateSalesOrder']>[2],
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
      model: 'SalesOrder',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Sales order berhasil diupdate' },
    })
  },

  delete_sales_order: async (args, context, params) => {
    const deleteResult = await salesOrdersService.deleteSalesOrder(
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
      model: 'SalesOrder',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Sales order berhasil dihapus' },
    })
  },
}
