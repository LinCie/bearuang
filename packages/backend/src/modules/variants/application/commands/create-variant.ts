import type { VariantRepository } from '../../domain/variant.repository'
import type { CreateVariantInput } from '../dto/mutate-variant.dto'
import type { VariantRecord } from '../../domain/variant'

interface CreateVariantDependencies {
  variantRepository: VariantRepository
}

export function createCreateVariant({
  variantRepository,
}: CreateVariantDependencies) {
  return function createVariant(
    input: CreateVariantInput,
  ): Promise<VariantRecord> {
    return variantRepository.create(input)
  }
}
