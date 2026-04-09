import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { productsService } from '#modules/products/products.service'
import { serializeProduct } from '#modules/products/products.route'
import { buildPaginationMeta } from '#common/pagination'
import { logAudit } from '#libraries/audit-logger'

export const productTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Cari produk berdasarkan kata kunci. Mengembalikan daftar produk dengan paginasi. Gunakan untuk mencari, melihat daftar, atau memfilter produk.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Kata kunci pencarian (nama produk, deskripsi)',
          },
          categoryId: {
            type: 'string',
            description:
              'Filter berdasarkan ID kategori. Kirim "null" untuk produk tanpa kategori.',
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
      name: 'get_product',
      description:
        'Ambil detail satu produk berdasarkan ID. Mengembalikan informasi lengkap termasuk variant dan gambar.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID produk' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_product',
      description:
        'Buat produk baru. Memerlukan nama dan slug (akan dibuat otomatis dari nama jika tidak diberikan).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama produk' },
          slug: {
            type: 'string',
            description:
              'Slug URL (huruf kecil, strip, garis bawah). Opsional — akan dibuat otomatis dari nama.',
          },
          description: {
            type: 'string',
            description: 'Deskripsi produk. Opsional.',
          },
          isActive: {
            type: 'boolean',
            description: 'Status aktif. Default: true.',
          },
          categoryId: {
            type: 'string',
            description:
              'ID kategori. Kirim null untuk tanpa kategori. Opsional.',
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
      name: 'update_product',
      description:
        'Update produk yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID produk yang akan diupdate',
          },
          name: { type: 'string', description: 'Nama baru produk' },
          slug: { type: 'string', description: 'Slug baru' },
          description: { type: 'string', description: 'Deskripsi baru' },
          isActive: { type: 'boolean', description: 'Status aktif' },
          categoryId: {
            type: 'string',
            description: 'ID kategori baru. Kirim null untuk tanpa kategori.',
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
      name: 'delete_product',
      description:
        'Hapus produk (soft delete). Produk dan semua variant-nya akan dipindahkan ke tempat sampah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID produk yang akan dihapus',
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
      name: 'restore_product',
      description: 'Pulihkan produk yang sudah dihapus dari tempat sampah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID produk yang akan dipulihkan',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

export const productPermissions: Record<string, string> = {
  search_products: 'product:view',
  get_product: 'product:view',
  create_product: 'product:create',
  update_product: 'product:update',
  delete_product: 'product:delete',
  restore_product: 'product:delete',
}

export const productSystemPrompt = `
### Produk & Variant
- **Mencari produk** — cari berdasarkan nama, deskripsi, atau kategori
- **Melihat detail produk** — lihat info lengkap termasuk variant dan gambar
- **Membuat produk baru** — dengan nama, slug (otomatis), deskripsi, kategori
- **Mengupdate produk** — ubah nama, deskripsi, kategori, status aktif
- **Menghapus produk** — pindahkan ke tempat sampah (soft delete)
- **Memulihkan produk** — kembalikan dari tempat sampah
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

export const productHandlers: Record<string, ToolHandler> = {
  search_products: async (args, context) => {
    const { page, pageSize, skip, sortBy, sortOrder } =
      buildPaginationArgs(args)
    const categoryId =
      args.categoryId === 'null'
        ? null
        : (args.categoryId as string | undefined)
    const { data, total } = await productsService.listProducts(
      context.organizationId,
      {
        skip,
        take: pageSize,
        search: args.search as string | undefined,
        categoryId,
        orderBy: {
          field: sortBy as 'name' | 'createdAt' | 'updatedAt',
          order: sortOrder as 'asc' | 'desc',
        },
      },
    )
    return JSON.stringify({
      success: true,
      data: data.map(serializeProduct),
      meta: buildPaginationMeta(total, page, pageSize),
    })
  },

  get_product: async (args, context) => {
    const product = await productsService.getProduct(
      context.organizationId,
      args.id as string,
    )
    if (!product) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Produk tidak ditemukan',
        },
      })
    }
    return JSON.stringify({
      success: true,
      data: serializeProduct(product),
    })
  },

  create_product: async (args, context, params) => {
    let slug = args.slug as string | undefined
    if (!slug) {
      slug = (args.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
    const product = await productsService.createProduct(
      context.organizationId,
      {
        name: args.name as string,
        slug,
        description: (args.description as string) ?? undefined,
        isActive: (args.isActive as boolean) ?? true,
        categoryId:
          args.categoryId === 'null'
            ? null
            : (args.categoryId as string | undefined),
      },
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Product',
      operation: 'create',
      args: { data: { name: args.name, slug } },
    })
    return JSON.stringify({
      success: true,
      data: serializeProduct(product),
    })
  },

  update_product: async (args, context, params) => {
    const data: Record<string, unknown> = {}
    if (args.name !== undefined) data.name = args.name
    if (args.slug !== undefined) data.slug = args.slug
    if (args.description !== undefined) data.description = args.description
    if (args.isActive !== undefined) data.isActive = args.isActive
    if (args.categoryId !== undefined) {
      data.categoryId = args.categoryId === 'null' ? null : args.categoryId
    }
    const result = await productsService.updateProduct(
      context.organizationId,
      args.id as string,
      data as Parameters<(typeof productsService)['updateProduct']>[2],
    )
    if (result.count === 0) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Produk tidak ditemukan',
        },
      })
    }
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Product',
      operation: 'update',
      args: { id: args.id, data },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Product updated' },
    })
  },

  delete_product: async (args, context, params) => {
    await productsService.deleteProduct(
      context.organizationId,
      args.id as string,
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Product',
      operation: 'delete',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Product deleted' },
    })
  },

  restore_product: async (args, context, params) => {
    await productsService.restoreProduct(
      context.organizationId,
      args.id as string,
    )
    void logAudit({
      organizationId: context.organizationId,
      userId: context.userId,
      authType: params.authType as 'session' | 'api_key',
      model: 'Product',
      operation: 'restore',
      args: { id: args.id },
    })
    return JSON.stringify({
      success: true,
      data: { message: 'Product restored' },
    })
  },
}
