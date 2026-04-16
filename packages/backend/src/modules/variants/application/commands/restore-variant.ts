import type { VariantRepository } from '../../domain/variant.repository'
import type { VariantIdentityInput } from '../dto/mutate-variant.dto'

interface RestoreVariantDependencies {
  variantRepository: VariantRepository
}

export function createRestoreVariant({
  variantRepository,
}: RestoreVariantDependencies) {
  return function restoreVariant(input: VariantIdentityInput): Promise<void> {
    return variantRepository.restore(input)
  }
}
