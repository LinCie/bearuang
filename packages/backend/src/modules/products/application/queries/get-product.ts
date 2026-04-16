import type { ProductRecord } from '../../domain/product'
import type { ProductRepository } from '../../domain/product.repository'

interface GetProductDependencies {
  productRepository: ProductRepository
}

export function createGetProduct({
  productRepository,
}: GetProductDependencies) {
  return function getProduct(input: {
    organizationId: string
    id: string
  }): Promise<ProductRecord | null> {
    return productRepository.getById(input)
  }
}
