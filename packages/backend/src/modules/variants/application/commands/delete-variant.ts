import type { VariantRepository } from '../../domain/variant.repository'
import type { VariantIdentityInput } from '../dto/mutate-variant.dto'

interface DeleteVariantDependencies {
  variantRepository: VariantRepository
}

export function createDeleteVariant({
  variantRepository,
}: DeleteVariantDependencies) {
  return function deleteVariant(input: VariantIdentityInput): Promise<void> {
    return variantRepository.softDelete(input)
  }
}
