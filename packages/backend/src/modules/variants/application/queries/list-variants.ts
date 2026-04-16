import type { VariantRepository } from '../../domain/variant.repository'
import type {
  ListVariantsInput,
  ListVariantsResult,
} from '../dto/list-variants.dto'

interface ListVariantsDependencies {
  variantRepository: VariantRepository
}

export function createListVariants({
  variantRepository,
}: ListVariantsDependencies) {
  return function listVariants(
    input: ListVariantsInput,
  ): Promise<ListVariantsResult> {
    return variantRepository.list(input)
  }
}
