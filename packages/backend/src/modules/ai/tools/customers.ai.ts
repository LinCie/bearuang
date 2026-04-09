import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { customersService } from '#modules/customers/customers.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const customerTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_customers',
      description:
        'Cari pelanggan berdasarkan kata kunci. Mengembalikan daftar pelanggan dengan paginasi.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (nama, email)',
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
      name: 'get_customer',
      description: 'Ambil detail satu pelanggan berdasarkan ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID pelanggan' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Buat pelanggan baru. Memerlukan nama pelanggan.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama pelanggan' },
          email: {
            type: 'string',
            description: 'Email pelanggan. Opsional.',
          },
          phone: {
            type: 'string',
            description: 'Nomor telepon pelanggan. Opsional.',
          },
          address: {
            type: 'string',
            description: 'Alamat pelanggan. Opsional.',
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
      name: 'update_customer',
      description:
        'Update pelanggan yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID pelanggan yang akan diupdate',
          },
          name: { type: 'string', description: 'Nama baru pelanggan' },
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
      name: 'delete_customer',
      description:
        'Hapus pelanggan (soft delete, mengubah isActive menjadi false).',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID pelanggan yang akan dihapus',
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
      name: 'restore_customer',
      description:
        'Pulihkan pelanggan yang sudah dihapus (mengubah isActive menjadi true).',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID pelanggan yang akan dipulihkan',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const customerPermissions: Record<string, string> = {
  search_customers: 'customer:view',
  get_customer: 'customer:view',
  create_customer: 'customer:create',
  update_customer: 'customer:update',
  delete_customer: 'customer:delete',
  restore_customer: 'customer:delete',
}

export const customerSystemPrompt = `
### Pelanggan
- **Mencari pelanggan** — cari berdasarkan nama atau email
- **Melihat detail pelanggan** — lihat info lengkap pelanggan
- **Membuat pelanggan baru** — dengan nama, email, telepon, alamat
- **Mengupdate pelanggan** — ubah nama, email, telepon, alamat, status aktif
- **Menghapus pelanggan** — soft delete (masih bisa dipulihkan)
- **Memulihkan pelanggan** — kembalikan pelanggan yang sudah dihapus
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

function serializeCustomer(c: {
  createdAt: Date
  updatedAt: Date
}): Record<string, unknown> {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const customerHandlers: Record<string, ToolHandler> = {
  search_customers: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const { data, total } = await customersService.listCustomers(
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
      data: data.map(serializeCustomer),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_customer: async (args, context) => {
    const customer = await customersService.getCustomer(
      context.organizationId,
      args.id as string,
    )
    if (!customer) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pelanggan tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: serializeCustomer(customer),
    })
  },

  create_customer: async (args, context, params) => {
    const customer = await customersService.createCustomer(
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
      model: 'Customer',
      operation: 'create',
      args: { data: { name: args.name } },
    })
    return JSON.stringify({
      success: true,
      data: serializeCustomer(customer),
    })
  },

  update_customer: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.name !== undefined) data.name = args.name
    if (args.email !== undefined) data.email = args.email
    if (args.phone !== undefined) data.phone = args.phone
    if (args.address !== undefined) data.address = args.address
    if (args.isActive !== undefined) data.isActive = args.isActive
    const result = await customersService.updateCustomer(
      context.organizationId,
      args.id as string,
      data as Parameters<(typeof customersService)['updateCustomer']>[2],
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pelanggan tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Customer',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Pelanggan berhasil diupdate' },
    })
  },

  delete_customer: async (args, context, params) => {
    const result = await customersService.deleteCustomer(
      context.organizationId,
      args.id as string,
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pelanggan tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Customer',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Pelanggan berhasil dihapus' },
    })
  },

  restore_customer: async (args, context, params) => {
    const result = await customersService.restoreCustomer(
      context.organizationId,
      args.id as string,
    )
    if (!result) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pelanggan tidak ditemukan atau sudah aktif',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Customer',
      operation: 'restore',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Pelanggan berhasil dipulihkan' },
    })
  },
}
