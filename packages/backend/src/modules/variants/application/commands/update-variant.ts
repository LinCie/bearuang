import type { VariantRepository } from '../../domain/variant.repository'
import type { UpdateVariantInput } from '../dto/mutate-variant.dto'
import type { MutateCountResult } from '../../domain/variant.repository'

interface UpdateVariantDependencies {
  variantRepository: VariantRepository
}

export function createUpdateVariant({
  variantRepository,
}: UpdateVariantDependencies) {
  return function updateVariant(
    input: UpdateVariantInput,
  ): Promise<MutateCountResult> {
    return variantRepository.update(input)
  }
}
