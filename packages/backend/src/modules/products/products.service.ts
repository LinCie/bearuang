import { prisma } from '#integrations/prisma'

const categorySelect = {
  select: { id: true, name: true, slug: true },
} as const

const productInclude = {
  category: categorySelect,
  variants: {
    where: { deletedAt: null },
    include: {
      images: {
        include: { media: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  },
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
} as const

const trashedProductInclude = {
  category: categorySelect,
  variants: {
    include: {
      images: {
        include: { media: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  },
  images: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
} as const

const mediaInclude = { media: true } as const

const sortOrderMax = { sortOrder: true } as const

const idSelect = { id: true } as const

const defaultOrderBy = { createdAt: 'desc' } as const

export const productsService = {
  /**
   * Lists active products for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and category filter parameters.
   * @returns The paginated list of products and total count.
   * @usage Used in products.route.ts, products.ai.ts
   * @sideEffects None (Read-only)
   */
  async listProducts(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      categoryId?: string | null
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params?.categoryId !== undefined && {
        categoryId: params.categoryId,
      }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            description: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : defaultOrderBy,
      }),
      prisma.product.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Lists soft-deleted products for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of trashed products and total count.
   * @usage Used in products.route.ts
   * @sideEffects None (Read-only)
   */
  async listTrashedProducts(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: { not: null },
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            description: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }
    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: trashedProductInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : defaultOrderBy,
      }),
      prisma.product.count({ where }),
    ])
    return { data, total }
  },

  /**
   * Retrieves a single active product.
   * @param organizationId - Organization identifier.
   * @param id - Product identifier.
   * @returns The product record or null if not found.
   * @usage Used in products.route.ts, products.ai.ts, variants.ai.ts
   * @sideEffects None (Read-only)
   */
  async getProduct(organizationId: string, id: string) {
    return prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: productInclude,
    })
  },

  /**
   * Creates a new product.
   * @param organizationId - Organization identifier.
   * @param data - Product creation data.
   * @returns The created product record.
   * @usage Used in products.route.ts, products.ai.ts
   * @sideEffects Creates a new record in the products table.
   */
  async createProduct(
    organizationId: string,
    data: {
      name: string
      slug: string
      description?: string
      isActive?: boolean
      categoryId?: string | null
    },
  ) {
    return prisma.product.create({
      data: { ...data, organizationId },
      include: productInclude,
    })
  },

  /**
   * Updates an active product.
   * @param organizationId - Organization identifier.
   * @param id - Product identifier.
   * @param data - Product update data.
   * @returns The number of updated records.
   * @usage Used in products.route.ts, products.ai.ts
   * @sideEffects Updates an existing record in the products table.
   */
  async updateProduct(
    organizationId: string,
    id: string,
    data: {
      name?: string
      slug?: string
      description?: string
      isActive?: boolean
      categoryId?: string | null
    },
  ) {
    return prisma.product.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    })
  },

  /**
   * Soft deletes a product and all its associated variants.
   * @param organizationId - Organization identifier.
   * @param id - Product identifier.
   * @returns A promise that resolves when deletion is complete.
   * @usage Used in products.route.ts, products.ai.ts
   * @sideEffects Updates deletedAt in products and productVariant tables.
   */
  async deleteProduct(organizationId: string, id: string) {
    const now = new Date()

    await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: { productId: id, organizationId, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.product.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ])
  },

  /**
   * Restores a soft-deleted product and its associated variants.
   * @param organizationId - Organization identifier.
   * @param id - Product identifier.
   * @returns A promise that resolves when restoration is complete.
   * @usage Used in products.route.ts, products.ai.ts
   * @sideEffects Resets deletedAt to null in products and productVariant tables.
   */
  async restoreProduct(organizationId: string, id: string) {
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { id, organizationId, deletedAt: { not: null } },
        data: { deletedAt: null },
      }),
      prisma.productVariant.updateMany({
        where: { productId: id, organizationId, deletedAt: { not: null } },
        data: { deletedAt: null },
      }),
    ])
  },

  /**
   * Adds an image to a product.
   * @param _organizationId - Organization identifier.
   * @param productId - Product identifier.
   * @param data - Image media ID and optional alt text.
   * @returns The created product image record.
   * @usage Used in products.route.ts
   * @sideEffects Creates a new record in productImage table and calculates sortOrder.
   */
  async addProductImage(
    _organizationId: string,
    productId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const maxSort = await prisma.productImage.aggregate({
      where: { productId },
      _max: sortOrderMax,
    })
    return prisma.productImage.create({
      data: {
        productId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: mediaInclude,
    })
  },

  /**
   * Removes an image from a product.
   * @param _organizationId - Organization identifier.
   * @param productId - Product identifier.
   * @param imageId - Product image identifier.
   * @returns The number of deleted records.
   * @usage Used in products.route.ts
   * @sideEffects Deletes a record from the productImage table.
   */
  async removeProductImage(
    _organizationId: string,
    productId: string,
    imageId: string,
  ) {
    return prisma.productImage.deleteMany({
      where: { id: imageId, productId },
    })
  },

  /**
   * Updates the sort order of product images.
   * @param _organizationId - Organization identifier.
   * @param productId - Product identifier.
   * @param imageIds - Ordered list of image identifiers.
   * @returns A promise that resolves when reordering is complete.
   * @usage Used in products.route.ts
   * @sideEffects Updates sortOrder in productImage table.
   */
  async reorderProductImages(
    _organizationId: string,
    productId: string,
    imageIds: string[],
  ) {
    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.productImage.updateMany({
          where: { id, productId },
          data: { sortOrder: index },
        }),
      ),
    )
  },

  /**
   * Lists products within a category and all its descendants.
   * @param organizationId - Organization identifier.
   * @param rootCategoryId - The root category identifier to start traversal from.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of products and total count.
   * @usage Used in product-categories.route.ts
   * @sideEffects None (Read-only, performs category tree traversal).
   */
  async listProductsByCategoryTree(
    organizationId: string,
    rootCategoryId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const categoryIds = [rootCategoryId]
    let frontier = [rootCategoryId]

    while (frontier.length > 0) {
      const children = await prisma.productCategory.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: idSelect,
      })
      if (children.length === 0) break
      const childIds = children.map((c) => c.id)
      categoryIds.push(...childIds)
      frontier = childIds
    }

    const where = {
      organizationId,
      deletedAt: null,
      categoryId: { in: categoryIds },
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          {
            description: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }

    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : defaultOrderBy,
      }),
      prisma.product.count({ where }),
    ])

    return { data, total }
  },
}
