import type { VariantRecord } from '../../domain/variant'
import type { VariantRepository } from '../../domain/variant.repository'

interface ListVariantsByProductDependencies {
  variantRepository: VariantRepository
}

export function createListVariantsByProduct({
  variantRepository,
}: ListVariantsByProductDependencies) {
  return function listVariantsByProduct(input: {
    organizationId: string
    productId: string
  }): Promise<VariantRecord[]> {
    return variantRepository.listByProduct(input)
  }
}
