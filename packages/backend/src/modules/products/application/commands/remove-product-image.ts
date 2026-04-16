import type {
  MutateCountResult,
  ProductRepository,
} from '../../domain/product.repository'
import type { RemoveProductImageInput } from '../dto/mutate-product.dto'

interface RemoveProductImageDependencies {
  productRepository: ProductRepository
}

export function createRemoveProductImage({
  productRepository,
}: RemoveProductImageDependencies) {
  return function removeProductImage(
    input: RemoveProductImageInput,
  ): Promise<MutateCountResult> {
    return productRepository.removeImage(input)
  }
}
