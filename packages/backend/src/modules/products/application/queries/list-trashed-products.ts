import type { ProductRepository } from '../../domain/product.repository'
import type {
  ListProductsInput,
  ListProductsResult,
} from '../dto/list-products.dto'

interface ListTrashedProductsDependencies {
  productRepository: ProductRepository
}

export function createListTrashedProducts({
  productRepository,
}: ListTrashedProductsDependencies) {
  return function listTrashedProducts(
    input: ListProductsInput,
  ): Promise<ListProductsResult> {
    return productRepository.listTrashed(input)
  }
}
