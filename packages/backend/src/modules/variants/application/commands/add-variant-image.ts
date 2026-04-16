import type { VariantRepository } from '../../domain/variant.repository'
import type { AddVariantImageInput } from '../dto/mutate-variant.dto'
import type { VariantImageRecord } from '../../domain/variant-image'

interface AddVariantImageDependencies {
  variantRepository: VariantRepository
}

export function createAddVariantImage({
  variantRepository,
}: AddVariantImageDependencies) {
  return function addVariantImage(
    input: AddVariantImageInput,
  ): Promise<VariantImageRecord> {
    return variantRepository.addImage(input)
  }
}
