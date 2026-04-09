import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { suppliersService } from '#modules/suppliers/suppliers.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const supplierTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_suppliers',
      description:
        'Cari supplier berdasarkan kata kunci. Mengembalikan daftar supplier dengan paginasi.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (nama, email, telepon, alamat)',
          },
          isActive: {
            type: 'boolean',
            description:
              'Filter berdasarkan status aktif. Kirim true untuk aktif, false untuk tidak aktif.',
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
      name: 'get_supplier',
      description: 'Ambil detail satu supplier berdasarkan ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID supplier' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_supplier',
      description: 'Buat supplier baru. Memerlukan nama supplier.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama supplier' },
          email: {
            type: 'string',
            description: 'Email supplier. Opsional.',
          },
          phone: {
            type: 'string',
            description: 'Nomor telepon supplier. Opsional.',
          },
          address: {
            type: 'string',
            description: 'Alamat supplier. Opsional.',
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
      name: 'update_supplier',
      description:
        'Update supplier yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID supplier yang akan diupdate',
          },
          name: { type: 'string', description: 'Nama baru supplier' },
          email: { type: 'string', description: 'Email baru' },
          phone: { type: 'string', description: 'Nomor telepon baru' },
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
      name: 'delete_supplier',
      description: 'Hapus supplier secara permanen.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID supplier yang akan dihapus',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const supplierPermissions: Record<string, string> = {
  search_suppliers: 'supplier:view',
  get_supplier: 'supplier:view',
  create_supplier: 'supplier:create',
  update_supplier: 'supplier:update',
  delete_supplier: 'supplier:delete',
}

export const supplierSystemPrompt = `
### Supplier
- **Mencari supplier** — cari berdasarkan nama, email, telepon, atau alamat
- **Melihat detail supplier** — lihat info lengkap supplier
- **Membuat supplier baru** — dengan nama, email, telepon, alamat
- **Mengupdate supplier** — ubah nama, email, telepon, alamat, status aktif
- **Menghapus supplier** — hapus secara permanen
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

export const supplierHandlers: Record<string, ToolHandler> = {
  search_suppliers: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const { data, total } = await suppliersService.listSuppliers(
      context.organizationId,
      {
        skip,
        take: pageSize,
        search: args.search as string | undefined,
        isActive:
          args.isActive === undefined ? undefined : (args.isActive as boolean),
        orderBy: {
          field: sortBy as 'name' | 'createdAt' | 'updatedAt',
          order: sortOrder as 'asc' | 'desc',
        },
      },
    )
    return JSON.stringify({
      success: true,
      data: data.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_supplier: async (args, context) => {
    const supplier = await suppliersService.getSupplier(
      context.organizationId,
      args.id as string,
    )
    if (!supplier) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supplier tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: {
        ...supplier,
        createdAt: supplier.createdAt.toISOString(),
        updatedAt: supplier.updatedAt.toISOString(),
      },
    })
  },

  create_supplier: async (args, context, params) => {
    const supplier = await suppliersService.createSupplier(
      context.organizationId,
      {
        name: args.name as string,
        email: (args.email as string) ?? undefined,
        phone: (args.phone as string) ?? undefined,
        address: (args.address as string) ?? undefined,
      },
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Supplier',
      operation: 'create',
      args: { data: { name: args.name } },
    })
    return JSON.stringify({
      success: true,
      data: {
        ...supplier,
        createdAt: supplier.createdAt.toISOString(),
        updatedAt: supplier.updatedAt.toISOString(),
      },
    })
  },

  update_supplier: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.name !== undefined) data.name = args.name
    if (args.email !== undefined) data.email = args.email
    if (args.phone !== undefined) data.phone = args.phone
    if (args.address !== undefined) data.address = args.address
    if (args.isActive !== undefined) data.isActive = args.isActive
    const result = await suppliersService.updateSupplier(
      context.organizationId,
      args.id as string,
      data as Parameters<(typeof suppliersService)['updateSupplier']>[2],
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supplier tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Supplier',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Supplier updated' },
    })
  },

  delete_supplier: async (args, context, params) => {
    const result = await suppliersService.deleteSupplier(
      context.organizationId,
      args.id as string,
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supplier tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Supplier',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Supplier deleted' },
    })
  },
}
