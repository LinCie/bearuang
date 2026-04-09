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
  /**
   * Lists active product categories for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search, parent filter and sorting parameters.
   * @returns The paginated list of categories and total count.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects None (Read-only)
   */
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

  /**
   * Lists soft-deleted product categories for an organization.
   * @param organizationId - Organization identifier.
   * @param params - Pagination, search and sorting parameters.
   * @returns The paginated list of trashed categories and total count.
   * @usage Used in product-categories.route.ts
   * @sideEffects None (Read-only)
   */
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

  /**
   * Retrieves a single active product category.
   * @param organizationId - Organization identifier.
   * @param id - Category identifier.
   * @returns The category record or null if not found.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects None (Read-only)
   */
  async getProductCategory(organizationId: string, id: string) {
    return prisma.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: categoryInclude,
    })
  },

  /**
   * Creates a new product category.
   * @param organizationId - Organization identifier.
   * @param data - Category creation data.
   * @returns The created category record.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects Creates a new record in the productCategory table.
   */
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

  /**
   * Updates an active product category.
   * @param organizationId - Organization identifier.
   * @param id - Category identifier.
   * @param data - Category update data.
   * @returns The number of updated records.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects Updates existing records in the productCategory table.
   */
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

  /**
   * Soft deletes a product category and reassigns its relationships.
   * @param organizationId - Organization identifier.
   * @param id - Category identifier.
   * @returns A promise that resolves when deletion is complete.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects Updates productCategory (sets parentId=null for child categories), product (sets categoryId=null for products), and soft-deletes the category (sets deletedAt).
   */
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

  /**
   * Restores a soft-deleted product category.
   * @param organizationId - Organization identifier.
   * @param id - Category identifier.
   * @returns The number of restored records.
   * @usage Used in product-categories.route.ts, categories.ai.ts
   * @sideEffects Resets deletedAt to null in the productCategory table.
   */
  async restoreProductCategory(organizationId: string, id: string) {
    return prisma.productCategory.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    })
  },
}
