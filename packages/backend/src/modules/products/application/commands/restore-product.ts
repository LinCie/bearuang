import type { ProductRepository } from '../../domain/product.repository'
import type { ProductIdentityInput } from '../dto/mutate-product.dto'

interface RestoreProductDependencies {
  productRepository: ProductRepository
}

export function createRestoreProduct({
  productRepository,
}: RestoreProductDependencies) {
  return function restoreProduct(input: ProductIdentityInput): Promise<void> {
    return productRepository.restore(input)
  }
}
