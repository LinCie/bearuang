import { Prisma } from '#generated/prisma/client'
import { prisma } from '#integrations/prisma'

const variantImagesInclude = {
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} as const

const variantWithProductInclude = {
  product: { select: { name: true } },
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} as const

const mediaInclude = { media: true } as const

const variantListOrderBy = { createdAt: 'asc' as const } as const

const variantDefaultOrderBy = { createdAt: 'desc' as const } as const

const variantSortOrderMax = { sortOrder: true } as const

export const variantsService = {
  /**
   * Lists active variants for a specific product.
   * @param organizationId - Organization identifier.
   * @param productId - Product identifier.
   * @returns Array of variant records with images.
   * @usage Used in variants.route.ts
   * @sideEffects None (Read-only)
   */
  async listVariantsByProduct(organizationId: string, productId: string) {
    return prisma.productVariant.findMany({
      where: { productId, organizationId, deletedAt: null },
      include: variantImagesInclude,
      orderBy: variantListOrderBy,
    })
  },

  /**
   * Lists active variants for an organization with pagination and search.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of variants and total count.
   * @usage Used in variants.route.ts
   * @sideEffects None (Read-only)
   */
  async listVariants(
    organizationId: string,
    params?: {
      search?: string
      skip?: number
      take?: number
      orderBy?: {
        field: 'name' | 'sku' | 'price' | 'stock' | 'createdAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params?.search
        ? {
            OR: [
              {
                name: { contains: params.search, mode: 'insensitive' as const },
              },
              {
                sku: { contains: params.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where,
        include: variantWithProductInclude,
        skip: params?.skip ? Number(params.skip) : undefined,
        take: params?.take ? Number(params.take) : 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : variantDefaultOrderBy,
      }),
      prisma.productVariant.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Lists soft-deleted variants for an organization with pagination and search.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of trashed variants and total count.
   * @usage Used in variants.route.ts
   * @sideEffects None (Read-only)
   */
  async listTrashedVariants(
    organizationId: string,
    params?: {
      search?: string
      skip?: number
      take?: number
      orderBy?: {
        field: 'name' | 'sku' | 'price' | 'stock' | 'createdAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: { not: null },
      ...(params?.search
        ? {
            OR: [
              {
                name: { contains: params.search, mode: 'insensitive' as const },
              },
              {
                sku: { contains: params.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where,
        include: variantWithProductInclude,
        skip: params?.skip ? Number(params.skip) : undefined,
        take: params?.take ? Number(params.take) : 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : variantDefaultOrderBy,
      }),
      prisma.productVariant.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Restores a soft-deleted variant.
   * @param organizationId - Organization identifier.
   * @param id - Variant identifier.
   * @returns The number of restored records.
   * @usage Used in variants.route.ts
   * @sideEffects Resets deletedAt to null in productVariant table.
   */
  async restoreVariant(organizationId: string, id: string) {
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    })
  },

  /**
   * Retrieves a single active variant.
   * @param organizationId - Organization identifier.
   * @param id - Variant identifier.
   * @returns The variant record or null if not found.
   * @usage Used in variants.route.ts
   * @sideEffects None (Read-only)
   */
  async getVariant(organizationId: string, id: string) {
    return prisma.productVariant.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: variantWithProductInclude,
    })
  },

  /**
   * Creates a new variant for a product.
   * @param organizationId - Organization identifier.
   * @param productId - Product identifier.
   * @param data - Variant creation data (sku, name, price, unit, attributes, isActive).
   * @returns The created variant record with images.
   * @usage Used in variants.route.ts, variants.ai.ts
   * @sideEffects Creates a new record in productVariant table.
   */
  async createVariant(
    organizationId: string,
    productId: string,
    data: {
      sku: string
      name: string
      price: number
      unit?: string
      attributes?: Record<string, unknown>
      isActive?: boolean
    },
  ) {
    const { attributes, ...restData } = data
    return prisma.productVariant.create({
      data: {
        ...restData,
        attributes: attributes
          ? (attributes as Prisma.InputJsonValue)
          : undefined,
        organizationId,
        productId,
      },
      include: variantImagesInclude,
    })
  },

  /**
   * Updates an active variant.
   * @param organizationId - Organization identifier.
   * @param id - Variant identifier.
   * @param data - Variant update data (sku, name, price, unit, attributes, isActive).
   * @returns The number of updated records.
   * @usage Used in variants.route.ts, variants.ai.ts
   * @sideEffects Updates an existing record in productVariant table.
   */
  async updateVariant(
    organizationId: string,
    id: string,
    data: {
      sku?: string
      name?: string
      price?: number
      unit?: string
      attributes?: Record<string, unknown>
      isActive?: boolean
    },
  ) {
    const { attributes, ...restData } = data
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        ...restData,
        attributes: attributes
          ? (attributes as Prisma.InputJsonValue)
          : undefined,
      },
    })
  },

  /**
   * Soft deletes a variant (sets deletedAt timestamp).
   * @param organizationId - Organization identifier.
   * @param id - Variant identifier.
   * @returns The number of deleted records.
   * @usage Used in variants.route.ts, variants.ai.ts
   * @sideEffects Sets deletedAt in productVariant table. Does NOT cascade to related records.
   *             Note: Stock movements and order references to this variant may still exist.
   */
  async deleteVariant(organizationId: string, id: string) {
    return prisma.productVariant.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  },

  /**
   * Adds an image to a variant.
   * @param organizationId - Organization identifier.
   * @param variantId - Variant identifier.
   * @param data - Image media ID and optional alt text.
   * @returns The created variant image record.
   * @usage Used in variants.route.ts
   * @sideEffects Creates a new record in variantImage table and calculates sortOrder.
   */
  async addVariantImage(
    organizationId: string,
    variantId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, deletedAt: null },
    })
    if (!variant) throw new Error('Variant not found')

    const maxOrder = await prisma.variantImage.aggregate({
      where: { variantId },
      _max: variantSortOrderMax,
    })

    return prisma.variantImage.create({
      data: {
        variantId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: mediaInclude,
    })
  },

  /**
   * Looks up an active variant by SKU.
   * @param organizationId - Organization identifier.
   * @param sku - Stock keeping unit identifier.
   * @returns The variant record or null if not found.
   * @usage Used in variants.route.ts (for POS/barcode lookups)
   * @sideEffects None (Read-only)
   */
  async lookupBySku(organizationId: string, sku: string) {
    return prisma.productVariant.findFirst({
      where: { sku, organizationId, deletedAt: null, isActive: true },
      include: variantWithProductInclude,
    })
  },

  /**
   * Removes an image from a variant.
   * @param organizationId - Organization identifier.
   * @param variantId - Variant identifier.
   * @param imageId - Variant image identifier.
   * @returns The number of deleted records.
   * @usage Used in variants.route.ts
   * @sideEffects Deletes a record from the variantImage table.
   */
  async removeVariantImage(
    organizationId: string,
    variantId: string,
    imageId: string,
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, deletedAt: null },
    })
    if (!variant) throw new Error('Variant not found')

    return prisma.variantImage.deleteMany({
      where: { id: imageId, variantId },
    })
  },
}
