import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { productCategoriesService } from '#modules/product-categories/product-categories.service'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

function serializeCategory(
  c: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...c }
  if (c.createdAt instanceof Date) result.createdAt = c.createdAt.toISOString()
  if (c.updatedAt instanceof Date) result.updatedAt = c.updatedAt.toISOString()
  if (c.deletedAt instanceof Date) result.deletedAt = c.deletedAt.toISOString()
  else if (c.deletedAt === null) result.deletedAt = null
  if (c.parent && typeof c.parent === 'object' && !Array.isArray(c.parent)) {
    const parent = { ...(c.parent as Record<string, unknown>) }
    if (parent.createdAt instanceof Date)
      parent.createdAt = parent.createdAt.toISOString()
    result.parent = parent
  }
  if (Array.isArray(c.children)) {
    result.children = c.children.map((child: Record<string, unknown>) => ({
      ...child,
    }))
  }
  return result
}

export const categoryTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_categories',
      description:
        'Daftar semua kategori produk. Gunakan untuk melihat kategori yang tersedia sebelum membuat atau mengkategorikan produk.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (nama kategori, deskripsi)',
          },
          parentId: {
            type: 'string',
            description:
              'Filter berdasarkan ID kategori induk. Kirim "null" untuk kategori root.',
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
            enum: ['name', 'createdAt', 'updatedAt', 'sortOrder'],
            description: 'Urutkan berdasarkan field. Default: sortOrder.',
          },
          sortOrder: {
            type: 'string',
            format: 'enum',
            enum: ['asc', 'desc'],
            description: 'Urutan pengurutan. Default: asc.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_category',
      description:
        'Ambil detail satu kategori berdasarkan ID. Mengembalikan informasi lengkap termasuk kategori induk dan sub-kategori.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID kategori' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description:
        'Buat kategori produk baru. Memerlukan nama dan slug (akan dibuat otomatis dari nama jika tidak diberikan).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama kategori' },
          slug: {
            type: 'string',
            description:
              'Slug URL (huruf kecil, strip, garis bawah). Opsional — akan dibuat otomatis dari nama.',
          },
          description: {
            type: 'string',
            description: 'Deskripsi kategori. Opsional.',
          },
          parentId: {
            type: 'string',
            description:
              'ID kategori induk. Kirim null untuk kategori root. Opsional.',
          },
          sortOrder: {
            type: 'number',
            description: 'Urutan tampilan. Default: 0.',
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
      name: 'update_category',
      description:
        'Update kategori yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID kategori yang akan diupdate',
          },
          name: { type: 'string', description: 'Nama baru kategori' },
          slug: { type: 'string', description: 'Slug baru' },
          description: { type: 'string', description: 'Deskripsi baru' },
          parentId: {
            type: 'string',
            description: 'ID kategori induk baru. Kirim null untuk root.',
          },
          sortOrder: { type: 'number', description: 'Urutan tampilan baru' },
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
      name: 'delete_category',
      description:
        'Hapus kategori (soft delete). Produk dalam kategori akan diubah menjadi tanpa kategori. Sub-kategori akan diubah menjadi root.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID kategori yang akan dihapus',
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
      name: 'restore_category',
      description: 'Pulihkan kategori yang sudah dihapus dari tempat sampah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID kategori yang akan dipulihkan',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const categoryPermissions: Record<string, string> = {
  list_categories: 'productCategory:view',
  get_category: 'productCategory:view',
  create_category: 'productCategory:create',
  update_category: 'productCategory:update',
  delete_category: 'productCategory:delete',
  restore_category: 'productCategory:delete',
}

export const categorySystemPrompt = `
### Kategori Produk
- **Melihat kategori** — daftar kategori yang tersedia
- **Melihat detail kategori** — lihat info lengkap termasuk kategori induk dan sub-kategori
- **Membuat kategori baru** — dengan nama, slug (otomatis), deskripsi, kategori induk
- **Mengupdate kategori** — ubah nama, deskripsi, kategori induk, urutan, status aktif
- **Menghapus kategori** — pindahkan ke tempat sampah (soft delete)
- **Memulihkan kategori** — kembalikan dari tempat sampah
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
  const sortBy = (args.sortBy as string) ?? 'sortOrder'
  const sortOrder = (args.sortOrder as string) ?? 'asc'
  return { page, pageSize, skip, sortBy, sortOrder }
}

export const categoryHandlers: Record<string, ToolHandler> = {
  list_categories: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const parentId =
      args.parentId === 'null' ? null : (args.parentId as string | undefined)
    const { data, total } =
      await productCategoriesService.listProductCategories(
        context.organizationId,
        {
          skip,
          take: pageSize,
          search: args.search as string | undefined,
          parentId,
          orderBy: {
            field: sortBy as 'name' | 'createdAt' | 'updatedAt' | 'sortOrder',
            order: sortOrder as 'asc' | 'desc',
          },
        },
      )
    return JSON.stringify({
      success: true,
      data: data.map(serializeCategory),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_category: async (args, context) => {
    const category = await productCategoriesService.getProductCategory(
      context.organizationId,
      args.id as string,
    )
    if (!category) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Kategori tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: serializeCategory(category as unknown as Record<string, unknown>),
    })
  },

  create_category: async (args, context, params) => {
    let slug = args.slug as string | undefined
    if (!slug) {
      slug = (args.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
    const category = await productCategoriesService.createProductCategory(
      context.organizationId,
      {
        name: args.name as string,
        slug,
        description: (args.description as string) ?? undefined,
        parentId:
          args.parentId === 'null'
            ? null
            : (args.parentId as string | undefined),
        sortOrder: (args.sortOrder as number) ?? 0,
        isActive: (args.isActive as boolean) ?? true,
      },
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'ProductCategory',
      operation: 'create',
      args: { data: { name: args.name, slug } },
    })
    return JSON.stringify({
      success: true,
      data: serializeCategory(category as unknown as Record<string, unknown>),
    })
  },

  update_category: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.name !== undefined) data.name = args.name
    if (args.slug !== undefined) data.slug = args.slug
    if (args.description !== undefined) data.description = args.description
    if (args.parentId !== undefined) {
      data.parentId = args.parentId === 'null' ? null : args.parentId
    }
    if (args.sortOrder !== undefined) data.sortOrder = args.sortOrder
    if (args.isActive !== undefined) data.isActive = args.isActive
    const result = await productCategoriesService.updateProductCategory(
      context.organizationId,
      args.id as string,
      data as Parameters<
        (typeof productCategoriesService)['updateProductCategory']
      >[2],
    )
    if (result.count === 0) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Kategori tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'ProductCategory',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Category updated' },
    })
  },

  delete_category: async (args, context, params) => {
    await productCategoriesService.deleteProductCategory(
      context.organizationId,
      args.id as string,
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'ProductCategory',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Category deleted' },
    })
  },

  restore_category: async (args, context, params) => {
    await productCategoriesService.restoreProductCategory(
      context.organizationId,
      args.id as string,
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'ProductCategory',
      operation: 'restore',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Category restored' },
    })
  },
}
