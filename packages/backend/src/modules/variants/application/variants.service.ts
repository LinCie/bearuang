import type { VariantRepository } from '../domain/variant.repository'
import type { ListVariantsInput } from './dto/list-variants.dto'
import type {
  CreateVariantInput,
  UpdateVariantInput,
  AddVariantImageInput,
} from './dto/mutate-variant.dto'
import { createAddVariantImage } from './commands/add-variant-image'
import { createCreateVariant } from './commands/create-variant'
import { createDeleteVariant } from './commands/delete-variant'
import { createRemoveVariantImage } from './commands/remove-variant-image'
import { createRestoreVariant } from './commands/restore-variant'
import { createUpdateVariant } from './commands/update-variant'
import { createGetVariant } from './queries/get-variant'
import { createListVariants } from './queries/list-variants'
import { createListVariantsByProduct } from './queries/list-variants-by-product'
import { createListTrashedVariants } from './queries/list-trashed-variants'
import { createLookupVariantBySku } from './queries/lookup-variant-by-sku'
import { createPrismaVariantRepository } from '../infrastructure/prisma/prisma-variant.repository'

const variantRepository = createPrismaVariantRepository()

export const variantsService = createVariantsService({
  variantRepository,
})

interface VariantsServiceDependencies {
  variantRepository: VariantRepository
}

export interface VariantsService {
  listVariants(
    organizationId: string,
    params?: Omit<ListVariantsInput, 'organizationId'>,
  ): ReturnType<ReturnType<typeof createListVariants>>
  listTrashedVariants(
    organizationId: string,
    params?: Omit<ListVariantsInput, 'organizationId'>,
  ): ReturnType<ReturnType<typeof createListTrashedVariants>>
  listVariantsByProduct(
    organizationId: string,
    productId: string,
  ): ReturnType<ReturnType<typeof createListVariantsByProduct>>
  getVariant(
    organizationId: string,
    id: string,
  ): ReturnType<ReturnType<typeof createGetVariant>>
  lookupBySku(
    organizationId: string,
    sku: string,
  ): ReturnType<ReturnType<typeof createLookupVariantBySku>>
  createVariant(
    organizationId: string,
    productId: string,
    data: Omit<CreateVariantInput, 'organizationId' | 'productId'>,
  ): ReturnType<ReturnType<typeof createCreateVariant>>
  updateVariant(
    organizationId: string,
    id: string,
    data: Omit<UpdateVariantInput, 'organizationId' | 'id'>,
  ): ReturnType<ReturnType<typeof createUpdateVariant>>
  deleteVariant(organizationId: string, id: string): Promise<void>
  restoreVariant(organizationId: string, id: string): Promise<void>
  addVariantImage(
    organizationId: string,
    variantId: string,
    data: Omit<AddVariantImageInput, 'organizationId' | 'variantId'>,
  ): ReturnType<ReturnType<typeof createAddVariantImage>>
  removeVariantImage(
    organizationId: string,
    variantId: string,
    imageId: string,
  ): ReturnType<ReturnType<typeof createRemoveVariantImage>>
}

export function createVariantsService({
  variantRepository,
}: VariantsServiceDependencies): VariantsService {
  const listVariants = createListVariants({ variantRepository })
  const listTrashedVariants = createListTrashedVariants({
    variantRepository,
  })
  const listVariantsByProduct = createListVariantsByProduct({
    variantRepository,
  })
  const getVariant = createGetVariant({ variantRepository })
  const lookupBySku = createLookupVariantBySku({ variantRepository })
  const createVariant = createCreateVariant({ variantRepository })
  const updateVariant = createUpdateVariant({ variantRepository })
  const deleteVariant = createDeleteVariant({ variantRepository })
  const restoreVariant = createRestoreVariant({ variantRepository })
  const addVariantImage = createAddVariantImage({ variantRepository })
  const removeVariantImage = createRemoveVariantImage({ variantRepository })

  return {
    listVariants(organizationId, params) {
      return listVariants({ organizationId, ...params })
    },
    listTrashedVariants(organizationId, params) {
      return listTrashedVariants({ organizationId, ...params })
    },
    listVariantsByProduct(organizationId, productId) {
      return listVariantsByProduct({ organizationId, productId })
    },
    getVariant(organizationId, id) {
      return getVariant({ organizationId, id })
    },
    lookupBySku(organizationId, sku) {
      return lookupBySku({ organizationId, sku })
    },
    createVariant(organizationId, productId, data) {
      return createVariant({ organizationId, productId, ...data })
    },
    updateVariant(organizationId, id, data) {
      return updateVariant({ organizationId, id, ...data })
    },
    deleteVariant(organizationId, id) {
      return deleteVariant({ organizationId, id })
    },
    restoreVariant(organizationId, id) {
      return restoreVariant({ organizationId, id })
    },
    addVariantImage(organizationId, variantId, data) {
      return addVariantImage({
        organizationId,
        variantId,
        mediaId: data.mediaId,
        altText: data.altText,
      })
    },
    removeVariantImage(organizationId, variantId, imageId) {
      return removeVariantImage({ organizationId, variantId, imageId })
    },
  }
}
