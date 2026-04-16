import type { VariantRepository } from '../../domain/variant.repository'
import type {
  ListVariantsInput,
  ListVariantsResult,
} from '../dto/list-variants.dto'

interface ListTrashedVariantsDependencies {
  variantRepository: VariantRepository
}

export function createListTrashedVariants({
  variantRepository,
}: ListTrashedVariantsDependencies) {
  return function listTrashedVariants(
    input: ListVariantsInput,
  ): Promise<ListVariantsResult> {
    return variantRepository.listTrashed(input)
  }
}
