import type { ProductRecord } from '../../domain/product'
import type { ProductRepository } from '../../domain/product.repository'

interface GetProductBySlugDependencies {
  productRepository: ProductRepository
}

export function createGetProductBySlug({
  productRepository,
}: GetProductBySlugDependencies) {
  return function getProductBySlug(input: {
    organizationId: string
    slug: string
  }): Promise<ProductRecord | null> {
    return productRepository.getBySlug(input)
  }
}
