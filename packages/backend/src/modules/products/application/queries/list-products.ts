import type { ProductRepository } from '../../domain/product.repository'
import type {
  ListProductsInput,
  ListProductsResult,
} from '../dto/list-products.dto'

interface ListProductsDependencies {
  productRepository: ProductRepository
}

export function createListProducts({
  productRepository,
}: ListProductsDependencies) {
  return function listProducts(
    input: ListProductsInput,
  ): Promise<ListProductsResult> {
    return productRepository.list(input)
  }
}
