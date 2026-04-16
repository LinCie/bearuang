import type { VariantWithProductRecord } from '../../domain/variant'
import type { VariantRepository } from '../../domain/variant.repository'

interface GetVariantDependencies {
  variantRepository: VariantRepository
}

export function createGetVariant({
  variantRepository,
}: GetVariantDependencies) {
  return function getVariant(input: {
    organizationId: string
    id: string
  }): Promise<VariantWithProductRecord | null> {
    return variantRepository.getById(input)
  }
}
