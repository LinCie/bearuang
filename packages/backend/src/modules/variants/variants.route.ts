import { variantsService } from './variants.service'
import { createVariantsRoute } from './interface/http/variants.route'

export const variantsRoute = createVariantsRoute({ variantsService })

export type {
  Variant,
  VariantWithProduct,
  CreateVariantInput,
  UpdateVariantInput,
  SearchVariantQuery,
  VariantImage,
} from './interface/http/variants.contract'
export {
  variantImageIdParam,
  productIdParam,
  lookupSkuQuery,
  addVariantImageDto,
} from './interface/http/variants.contract'
