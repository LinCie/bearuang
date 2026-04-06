import { prisma } from '#integrations/prisma'

const sortOrderAscOrderBy = { sortOrder: 'asc' } as const

const createdAtDescOrderBy = { createdAt: 'desc' } as const

const defaultCategoryOrderBy = [
  { sortOrder: 'asc' },
  { createdAt: 'desc' },
] as [{ sortOrder: 'asc' }, { createdAt: 'desc' }]

const trashedCategoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
} as const

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  children: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, sortOrder: true },
    orderBy: sortOrderAscOrderBy,
  },
  _count: { select: { products: true } },
} as const

export const productCategoriesService = {
  async listProductCategories(
    organizationId: string,
    params?: {
      skip?: number
      take?: number
      search?: string
      parentId?: string | null
      orderBy?: {
        field: 'name' | 'createdAt' | 'updatedAt' | 'sortOrder'
        order: 'asc' | 'desc'
      }
    },
  ) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(params?.parentId !== undefined && {
        parentId: params.parentId,
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
      prisma.productCategory.findMany({
        where,
        include: categoryInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : defaultCategoryOrderBy,
      }),
      prisma.productCategory.count({ where }),
    ])

    return { data, total }
  },

  async listTrashedProductCategories(
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
      prisma.productCategory.findMany({
        where,
        include: trashedCategoryInclude,
        skip: params?.skip,
        take: params?.take ?? 50,
        orderBy: params?.orderBy
          ? { [params.orderBy.field]: params.orderBy.order }
          : createdAtDescOrderBy,
      }),
      prisma.productCategory.count({ where }),
    ])

    return { data, total }
  },

  async getProductCategory(organizationId: string, id: string) {
    return prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: categoryInclude,
    })
  },

  async createProductCategory(
    organizationId: string,
    data: {
      name: string
      slug: string
      description?: string
      parentId?: string | null
      sortOrder?: number
      isActive?: boolean
    },
  ) {
    return prisma.productCategory.create({
      data: { ...data, organizationId },
      include: categoryInclude,
    })
  },

  async updateProductCategory(
    organizationId: string,
    id: string,
    data: {
      name?: string
      slug?: string
      description?: string
      parentId?: string | null
      sortOrder?: number
      isActive?: boolean
    },
  ) {
    return prisma.productCategory.updateMany({
      where: { id, organizationId, deletedAt: null },
      data,
    })
  },

  async deleteProductCategory(organizationId: string, id: string) {
    const now = new Date()

    await prisma.$transaction([
      prisma.productCategory.updateMany({
        where: { parentId: id, organizationId, deletedAt: null },
        data: { parentId: null },
      }),
      prisma.product.updateMany({
        where: { categoryId: id, organizationId, deletedAt: null },
        data: { categoryId: null },
      }),
      prisma.productCategory.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ])
  },

  async restoreProductCategory(organizationId: string, id: string) {
    return prisma.productCategory.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    })
  },
}
