import type { VariantWithProductRecord } from '../../domain/variant'
import type { VariantRepository } from '../../domain/variant.repository'

interface LookupVariantBySkuDependencies {
  variantRepository: VariantRepository
}

export function createLookupVariantBySku({
  variantRepository,
}: LookupVariantBySkuDependencies) {
  return function lookupVariantBySku(input: {
    organizationId: string
    sku: string
  }): Promise<VariantWithProductRecord | null> {
    return variantRepository.getBySku(input)
  }
}
