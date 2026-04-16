import type { ProductCategoryTreeRepository } from '../../domain/product-category-tree.repository'
import type { ProductRepository } from '../../domain/product.repository'
import type {
  ListProductsByCategoryTreeInput,
  ListProductsResult,
} from '../dto/list-products.dto'

interface ListProductsByCategoryTreeDependencies {
  productRepository: ProductRepository
  productCategoryTreeRepository: ProductCategoryTreeRepository
}

export function createListProductsByCategoryTree({
  productRepository,
  productCategoryTreeRepository,
}: ListProductsByCategoryTreeDependencies) {
  return async function listProductsByCategoryTree(
    input: ListProductsByCategoryTreeInput,
  ): Promise<ListProductsResult> {
    const categoryIds =
      await productCategoryTreeRepository.getDescendantCategoryIds({
        organizationId: input.organizationId,
        rootCategoryId: input.rootCategoryId,
      })

    return productRepository.list({
      organizationId: input.organizationId,
      skip: input.skip,
      take: input.take,
      search: input.search,
      orderBy: input.orderBy,
      categoryIds,
    })
  }
}
