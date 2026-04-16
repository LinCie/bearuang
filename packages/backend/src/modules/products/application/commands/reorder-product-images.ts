import type { ProductRepository } from '../../domain/product.repository'
import type { ReorderProductImagesInput } from '../dto/mutate-product.dto'

interface ReorderProductImagesDependencies {
  productRepository: ProductRepository
}

export function createReorderProductImages({
  productRepository,
}: ReorderProductImagesDependencies) {
  return function reorderProductImages(
    input: ReorderProductImagesInput,
  ): Promise<void> {
    return productRepository.reorderImages(input)
  }
}
