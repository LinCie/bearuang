import { prisma } from '#integrations/prisma'
import type { ProductCategoryTreeRepository } from '../../domain/product-category-tree.repository'

const idSelect = { id: true } as const

export function createPrismaProductCategoryTreeRepository(): ProductCategoryTreeRepository {
  return {
    async getDescendantCategoryIds({ organizationId, rootCategoryId }) {
      const categoryIds = [rootCategoryId]
      let frontier = [rootCategoryId]

      while (frontier.length > 0) {
        const children = await prisma.productCategory.findMany({
          where: {
            organizationId,
            parentId: { in: frontier },
            deletedAt: null,
          },
          select: idSelect,
        })

        if (children.length === 0) {
          break
        }

        const childIds = children.map((category) => category.id)
        categoryIds.push(...childIds)
        frontier = childIds
      }

      return categoryIds
    },
  }
}
