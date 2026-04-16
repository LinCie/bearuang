import type { ProductImageRecord } from '../../domain/product-image'
import type { ProductRepository } from '../../domain/product.repository'
import type { AddProductImageInput } from '../dto/mutate-product.dto'

interface AddProductImageDependencies {
  productRepository: ProductRepository
}

export function createAddProductImage({
  productRepository,
}: AddProductImageDependencies) {
  return function addProductImage(
    input: AddProductImageInput,
  ): Promise<ProductImageRecord> {
    return productRepository.addImage(input)
  }
}
