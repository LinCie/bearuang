import type { ProductRepository } from '../../domain/product.repository'
import type { ProductIdentityInput } from '../dto/mutate-product.dto'

interface DeleteProductDependencies {
  productRepository: ProductRepository
}

export function createDeleteProduct({
  productRepository,
}: DeleteProductDependencies) {
  return function deleteProduct(input: ProductIdentityInput): Promise<void> {
    return productRepository.softDelete(input)
  }
}
