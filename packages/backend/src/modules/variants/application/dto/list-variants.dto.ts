import type {
  ListVariantsParams,
  ListVariantsResult,
  VariantSort,
} from '../../domain/variant.repository'

export type { ListVariantsResult, VariantSort }

export type ListVariantsInput = Pick<
  ListVariantsParams,
  'organizationId' | 'skip' | 'take' | 'search' | 'orderBy'
>
