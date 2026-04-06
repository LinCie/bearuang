import type {
  ToolDefinition,
  ToolExecutor,
  RunToolLoopResult,
} from '#integrations/llm'
import { runToolLoop } from '#integrations/llm'
import { productsService } from '#modules/products/products.service'
import { serializeProduct } from '#modules/products/products.route'
import { variantsService } from '#modules/variants/variants.service'
import { productCategoriesService } from '#modules/product-categories/product-categories.service'
import { buildPaginationMeta } from '#common/pagination'
import { getPublicUrl } from '#integrations/s3'
import { logAudit } from '#libraries/audit-logger'

function serializeVariant(v: Record<string, unknown>): Record<string, unknown> {
  const result = { ...v }
  if (v.price && typeof v.price === 'object' && 'toNumber' in v.price) {
    result.price = (v.price as { toNumber: () => number }).toNumber()
  }
  if (v.createdAt instanceof Date) result.createdAt = v.createdAt.toISOString()
  if (v.updatedAt instanceof Date) result.updatedAt = v.updatedAt.toISOString()
  if (v.deletedAt instanceof Date) result.deletedAt = v.deletedAt.toISOString()
  else if (v.deletedAt === null) result.deletedAt = null
  if (Array.isArray(v.images)) {
    result.images = v.images.map((img: Record<string, unknown>) => {
      const serialized = { ...img }
      if (img.createdAt instanceof Date)
        serialized.createdAt = img.createdAt.toISOString()
      if (
        img.media &&
        typeof img.media === 'object' &&
        !Array.isArray(img.media)
      ) {
        const media = { ...(img.media as Record<string, unknown>) }
        if (media.createdAt instanceof Date)
          media.createdAt = media.createdAt.toISOString()
        if (media.key) media.url = getPublicUrl(media.key as string)
        serialized.media = media
      }
      return serialized
    })
  }
  return result
}

const productTools: ToolDefinition[] = [
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
  {
    type: 'function',
    function: {
      name: 'list_categories',
      description:
        'Daftar semua kategori produk. Gunakan untuk melihat kategori yang tersedia sebelum membuat atau mengkategorikan produk.',
      parameters: {
        type: 'object',
        properties: {
          parentId: {
            type: 'string',
            description:
              'Filter berdasarkan ID kategori induk. Kirim "null" untuk kategori root.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_variants',
      description:
        'Lihat daftar variant dari sebuah produk. Gunakan untuk melihat detail variant seperti SKU, harga, dan stok.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'UUID produk',
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_variant',
      description:
        'Buat variant baru untuk sebuah produk. Memerlukan SKU yang unik.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'UUID produk induk',
          },
          sku: {
            type: 'string',
            description: 'SKU variant (harus unik dalam organisasi)',
          },
          name: { type: 'string', description: 'Nama variant' },
          price: { type: 'number', description: 'Harga variant' },
          unit: {
            type: 'string',
            description: 'Satuan (contoh: pcs, kg, liter). Default: pcs.',
          },
          isActive: {
            type: 'boolean',
            description: 'Status aktif. Default: true.',
          },
        },
        required: ['productId', 'sku', 'name', 'price'],
      },
    },
    isWrite: true,
  },
  {
    type: 'function',
    function: {
      name: 'update_variant',
      description:
        'Update variant yang sudah ada. Hanya field yang diberikan yang akan diubah.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID variant yang akan diupdate',
          },
          sku: { type: 'string', description: 'SKU baru' },
          name: { type: 'string', description: 'Nama baru' },
          price: { type: 'number', description: 'Harga baru' },
          unit: { type: 'string', description: 'Satuan baru' },
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
      name: 'delete_variant',
      description: 'Hapus variant (soft delete).',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'UUID variant yang akan dihapus',
          },
        },
        required: ['id'],
      },
    },
    isWrite: true,
  },
]

const TOOL_PERMISSIONS: Record<string, string> = {
  search_products: 'product:view',
  get_product: 'product:view',
  create_product: 'product:create',
  update_product: 'product:update',
  delete_product: 'product:delete',
  restore_product: 'product:delete',
  list_categories: 'productCategory:view',
  get_product_variants: 'productVariant:view',
  create_variant: 'productVariant:create',
  update_variant: 'productVariant:update',
  delete_variant: 'productVariant:delete',
}

const SYSTEM_PROMPT = `
Kamu adalah asisten manajemen inventaris produk yang membantu pengguna mengelola produk, variant, dan kategori. Kamu sangat membantu, responsif, dan selalu memberikan informasi yang akurat.

## Kemampuan Kamu

Kamu dapat melakukan operasi berikut:
- **Mencari produk** — cari berdasarkan nama, deskripsi, atau kategori
- **Melihat detail produk** — lihat info lengkap termasuk variant dan gambar
- **Membuat produk baru** — dengan nama, slug (otomatis), deskripsi, kategori
- **Mengupdate produk** — ubah nama, deskripsi, kategori, status aktif
- **Menghapus produk** — pindahkan ke tempat sampah (soft delete)
- **Memulihkan produk** — kembalikan dari tempat sampah
- **Melihat kategori** — daftar kategori yang tersedia
- **Melihat variant** — daftar variant produk dengan SKU, harga, stok
- **Membuat variant** — tambah variant baru ke produk
- **Mengupdate variant** — ubah SKU, nama, harga, satuan
- **Menghapus variant** — pindahkan ke tempat sampah

## Aturan Penting

1. **Operasi baca (cari, lihat, daftar)**: Langsung eksekusi tanpa konfirmasi.
2. **Operasi tulis (buat, update, hapus, pulihkan)**: Sistem akan secara otomatis mencegah eksekusi operasi tulis dan mengembalikan status "menunggu konfirmasi". Jika kamu menerima hasil tool dengan status pending, jelaskan kepada pengguna operasi apa yang diminta dan beritahu bahwa mereka perlu mengkonfirmasi melalui tombol konfirmasi di UI.
3. **Setelah konfirmasi**: Jika operasi tulis berhasil dieksekusi setelah konfirmasi, laporkan hasilnya kepada pengguna.
4. **Tampilkan data dengan rapi** — gunakan daftar atau tabel yang mudah dibaca.
5. **Jika terjadi error izin**, jelaskan kepada pengguna bahwa mereka tidak memiliki izin yang diperlukan.
6. **Jika produk tidak ditemukan**, informasikan kepada pengguna.
7. **Gunakan bahasa Indonesia** untuk semua respons.
8. **Slug otomatis** — jika pengguna tidak memberikan slug saat membuat produk, slug akan dibuat otomatis dari nama.
`

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

function buildExecuteTool(params: {
  authType: string
  checkPermission: (permission: string) => Promise<boolean>
}): ToolExecutor {
  return async (toolName, args, context) => {
    const permission = TOOL_PERMISSIONS[toolName]
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

    try {
      switch (toolName) {
        case 'search_products': {
          const page = Math.max(1, Math.floor(Number(args.page) || 1))
          const pageSize = Math.min(
            Math.max(1, Math.floor(Number(args.pageSize) || 10)),
            50,
          )
          const skip = (page - 1) * pageSize
          const sortBy = (args.sortBy as string) ?? 'createdAt'
          const sortOrder = (args.sortOrder as string) ?? 'desc'
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
        }

        case 'get_product': {
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
        }

        case 'create_product': {
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
        }

        case 'update_product': {
          const data: Record<string, unknown> = {}
          if (args.name !== undefined) data.name = args.name
          if (args.slug !== undefined) data.slug = args.slug
          if (args.description !== undefined)
            data.description = args.description
          if (args.isActive !== undefined) data.isActive = args.isActive
          if (args.categoryId !== undefined) {
            data.categoryId =
              args.categoryId === 'null' ? null : args.categoryId
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
        }

        case 'delete_product': {
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
        }

        case 'restore_product': {
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
        }

        case 'list_categories': {
          const parentId =
            args.parentId === 'null'
              ? null
              : (args.parentId as string | undefined)
          const { data, total } =
            await productCategoriesService.listProductCategories(
              context.organizationId,
              { parentId },
            )
          return JSON.stringify({
            success: true,
            data: data.map(serializeCategory),
            meta: buildPaginationMeta(total, 1, data.length),
          })
        }

        case 'get_product_variants': {
          const product = await productsService.getProduct(
            context.organizationId,
            args.productId as string,
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
            data: product.variants.map(serializeVariant),
          })
        }

        case 'create_variant': {
          const variant = await variantsService.createVariant(
            context.organizationId,
            args.productId as string,
            {
              sku: args.sku as string,
              name: args.name as string,
              price: args.price as number,
              unit: (args.unit as string) ?? 'pcs',
              isActive: (args.isActive as boolean) ?? true,
            },
          )
          void logAudit({
            organizationId: context.organizationId,
            userId: context.userId,
            authType: params.authType as 'session' | 'api_key',
            model: 'ProductVariant',
            operation: 'create',
            args: { productId: args.productId, sku: args.sku },
          })
          return JSON.stringify({
            success: true,
            data: serializeVariant(
              variant as unknown as Record<string, unknown>,
            ),
          })
        }

        case 'update_variant': {
          const data: Record<string, unknown> = {}
          if (args.sku !== undefined) data.sku = args.sku
          if (args.name !== undefined) data.name = args.name
          if (args.price !== undefined) data.price = args.price
          if (args.unit !== undefined) data.unit = args.unit
          if (args.isActive !== undefined) data.isActive = args.isActive
          const result = await variantsService.updateVariant(
            context.organizationId,
            args.id as string,
            data as Parameters<(typeof variantsService)['updateVariant']>[2],
          )
          if (result.count === 0) {
            return JSON.stringify({
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Variant tidak ditemukan',
              },
            })
          }
          void logAudit({
            organizationId: context.organizationId,
            userId: context.userId,
            authType: params.authType as 'session' | 'api_key',
            model: 'ProductVariant',
            operation: 'update',
            args: { id: args.id, data },
          })
          return JSON.stringify({
            success: true,
            data: { message: 'Variant updated' },
          })
        }

        case 'delete_variant': {
          await variantsService.deleteVariant(
            context.organizationId,
            args.id as string,
          )
          void logAudit({
            organizationId: context.organizationId,
            userId: context.userId,
            authType: params.authType as 'session' | 'api_key',
            model: 'ProductVariant',
            operation: 'delete',
            args: { id: args.id },
          })
          return JSON.stringify({
            success: true,
            data: { message: 'Variant deleted' },
          })
        }

        default:
          return JSON.stringify({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: `Unknown tool: ${toolName}`,
            },
          })
      }
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

/** @param params - Chat parameters including user message, conversation history, and auth context. @returns The AI assistant's result including reply, pending actions, and action results. */
export const aiService = {
  async chat(params: {
    userMessage: string
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
    confirmedWriteTools?: string[]
    userId: string
    organizationId: string
    userRole: string
    authType: string
    checkPermission: (permission: string) => Promise<boolean>
  }): Promise<RunToolLoopResult> {
    return runToolLoop({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: params.userMessage,
      conversationHistory: params.conversationHistory,
      tools: productTools,
      maxIterations: 10,
      confirmedWriteTools: params.confirmedWriteTools,
      toolContext: {
        userId: params.userId,
        organizationId: params.organizationId,
        userRole: params.userRole,
        authType: params.authType,
      },
      executeTool: buildExecuteTool(params),
    })
  },
}
