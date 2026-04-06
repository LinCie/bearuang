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

  async getProduct(organizationId: string, id: string) {
    return prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: productInclude,
    })
  },

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

  async removeProductImage(
    _organizationId: string,
    productId: string,
    imageId: string,
  ) {
    return prisma.productImage.deleteMany({
      where: { id: imageId, productId },
    })
  },

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

  async addVariantImage(
    _organizationId: string,
    variantId: string,
    data: { mediaId: string; altText?: string },
  ) {
    const maxSort = await prisma.variantImage.aggregate({
      where: { variantId },
      _max: sortOrderMax,
    })
    return prisma.variantImage.create({
      data: {
        variantId,
        mediaId: data.mediaId,
        altText: data.altText,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: mediaInclude,
    })
  },

  async removeVariantImage(
    _organizationId: string,
    variantId: string,
    imageId: string,
  ) {
    return prisma.variantImage.deleteMany({
      where: { id: imageId, variantId },
    })
  },

  async reorderVariantImages(
    _organizationId: string,
    variantId: string,
    imageIds: string[],
  ) {
    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.variantImage.updateMany({
          where: { id, variantId },
          data: { sortOrder: index },
        }),
      ),
    )
  },

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
