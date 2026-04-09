import type { ToolDefinition } from '#integrations/llm'
import type { ToolHandler } from './types'
import { variantsService } from '#modules/variants/variants.service'
import { productsService } from '#modules/products/products.service'
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

export const variantTools: ToolDefinition[] = [
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

export const variantPermissions: Record<string, string> = {
  get_product_variants: 'productVariant:view',
  create_variant: 'productVariant:create',
  update_variant: 'productVariant:update',
  delete_variant: 'productVariant:delete',
}

export const variantSystemPrompt = `
- **Melihat variant** — daftar variant produk dengan SKU, harga, stok
- **Membuat variant** — tambah variant baru ke produk
- **Mengupdate variant** — ubah SKU, nama, harga, satuan
- **Menghapus variant** — pindahkan ke tempat sampah
`

export const variantHandlers: Record<string, ToolHandler> = {
  get_product_variants: async (args, context) => {
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
  },

  create_variant: async (args, context, params) => {
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
      data: serializeVariant(variant as unknown as Record<string, unknown>),
    })
  },

  update_variant: async (args, context, params) => {
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
  },

  delete_variant: async (args, context, params) => {
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
  },
}
