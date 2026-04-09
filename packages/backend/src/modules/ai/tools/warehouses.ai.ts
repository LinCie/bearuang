import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { warehousesService } from '#modules/warehouses/warehouses.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const warehouseTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_warehouses',
      description:
        'Daftar semua gudang. Gunakan untuk melihat gudang yang tersedia.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (nama gudang, alamat)',
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
            enum: ['name', 'createdAt', 'updatedAt'],
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
      name: 'get_warehouse',
      description: 'Ambil detail satu gudang berdasarkan ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID gudang' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_warehouse',
      description: 'Buat gudang baru. Memerlukan nama gudang.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama gudang' },
          address: {
            type: 'string',
            description: 'Alamat gudang. Opsional.',
          },
          isActive: {
            type: 'boolean',
            description: 'Status aktif. Default: true.',
          },
        },
        required: ['name'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'update_warehouse',
      description:
        'Update gudang yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID gudang yang akan diupdate',
          },
          name: { type: 'string', description: 'Nama baru gudang' },
          address: { type: 'string', description: 'Alamat baru' },
          isActive: { type: 'boolean', description: 'Status aktif' },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'delete_warehouse',
      description: 'Hapus gudang secara permanen.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID gudang yang akan dihapus',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const warehousePermissions: Record<string, string> = {
  list_warehouses: 'warehouse:view',
  get_warehouse: 'warehouse:view',
  create_warehouse: 'warehouse:create',
  update_warehouse: 'warehouse:update',
  delete_warehouse: 'warehouse:delete',
}

export const warehouseSystemPrompt = `
### Gudang
- **Melihat daftar gudang** — daftar semua gudang dengan filter
- **Melihat detail gudang** — lihat info lengkap gudang
- **Membuat gudang baru** — dengan nama dan alamat
- **Mengupdate gudang** — ubah nama, alamat, status aktif
- **Menghapus gudang** — hapus secara permanen
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

export const warehouseHandlers: Record<string, ToolHandler> = {
  list_warehouses: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const { data, total } = await warehousesService.listWarehouses(
      context.organizationId,
      {
        skip,
        take: pageSize,
        search: args.search as string | undefined,
        orderBy: {
          field: sortBy as 'name' | 'createdAt' | 'updatedAt',
          order: sortOrder as 'asc' | 'desc',
        },
      },
    )
    return JSON.stringify({
      success: true,
      data: data.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_warehouse: async (args, context) => {
    const warehouse = await warehousesService.getWarehouse(
      context.organizationId,
      args.id as string,
    )
    if (!warehouse) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Gudang tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: {
        ...warehouse,
        createdAt: warehouse.createdAt.toISOString(),
        updatedAt: warehouse.updatedAt.toISOString(),
      },
    })
  },

  create_warehouse: async (args, context, params) => {
    const warehouse = await warehousesService.createWarehouse(
      context.organizationId,
      {
        name: args.name as string,
        address: (args.address as string) ?? undefined,
        isActive: (args.isActive as boolean) ?? true,
      },
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Warehouse',
      operation: 'create',
      args: { data: { name: args.name } },
    })
    return JSON.stringify({
      success: true,
      data: {
        ...warehouse,
        createdAt: warehouse.createdAt.toISOString(),
        updatedAt: warehouse.updatedAt.toISOString(),
      },
    })
  },

  update_warehouse: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.name !== undefined) data.name = args.name
    if (args.address !== undefined) data.address = args.address
    if (args.isActive !== undefined) data.isActive = args.isActive
    const result = await warehousesService.updateWarehouse(
      context.organizationId,
      args.id as string,
      data as Parameters<(typeof warehousesService)['updateWarehouse']>[2],
    )
    if (result.count === 0) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Gudang tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Warehouse',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Warehouse updated' },
    })
  },

  delete_warehouse: async (args, context, params) => {
    const result = await warehousesService.deleteWarehouse(
      context.organizationId,
      args.id as string,
    )
    if (result.count === 0) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Gudang tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Warehouse',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Warehouse deleted' },
    })
  },
}
