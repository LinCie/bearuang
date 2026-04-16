import type { ProductRecord } from '../../domain/product'
import type { ProductRepository } from '../../domain/product.repository'
import type { CreateProductInput } from '../dto/mutate-product.dto'

interface CreateProductDependencies {
  productRepository: ProductRepository
}

export function createCreateProduct({
  productRepository,
}: CreateProductDependencies) {
  return function createProduct(
    input: CreateProductInput,
  ): Promise<ProductRecord> {
    return productRepository.create(input)
  }
}
