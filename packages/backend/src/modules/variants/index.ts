import { createVariantsService } from './application/variants.service'
import { createPrismaVariantRepository } from './infrastructure/prisma/prisma-variant.repository'
import { createVariantsRoute } from './interface/http/variants.route'

const variantRepository = createPrismaVariantRepository()

const variantsService = createVariantsService({
  variantRepository,
})

export const variantsRoute = createVariantsRoute({ variantsService })

export { variantRepository, variantsService }
export * from './application/variants.service'
export * from './domain/variant'
export * from './domain/variant-image'
export * from './domain/variant.errors'
export * from './domain/variant.repository'
export * from './interface/http/variants.contract'
export * from './interface/http/variants.route'
export * from './interface/presenters/variant.presenter'
