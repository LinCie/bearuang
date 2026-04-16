import type {
  MutateCountResult,
  ProductRepository,
} from '../../domain/product.repository'
import type { UpdateProductInput } from '../dto/mutate-product.dto'

interface UpdateProductDependencies {
  productRepository: ProductRepository
}

export function createUpdateProduct({
  productRepository,
}: UpdateProductDependencies) {
  return function updateProduct(
    input: UpdateProductInput,
  ): Promise<MutateCountResult> {
    return productRepository.update(input)
  }
}
