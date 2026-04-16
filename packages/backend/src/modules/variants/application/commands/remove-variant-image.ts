import type { VariantRepository } from '../../domain/variant.repository'
import type { RemoveVariantImageInput } from '../dto/mutate-variant.dto'
import type { MutateCountResult } from '../../domain/variant.repository'

interface RemoveVariantImageDependencies {
  variantRepository: VariantRepository
}

export function createRemoveVariantImage({
  variantRepository,
}: RemoveVariantImageDependencies) {
  return function removeVariantImage(
    input: RemoveVariantImageInput,
  ): Promise<MutateCountResult> {
    return variantRepository.removeImage(input)
  }
}
