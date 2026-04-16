import { productsService } from './products.service'
import { createProductsRoute } from './interface/http/products.route'

export const productsRoute = createProductsRoute({ productsService })

export {
  addImageDto,
  createProductDto,
  imageIdParam,
  listProductsQuery,
  productIdParam,
  productImageSchema,
  productSchema,
  reorderImagesDto,
  slugParam,
  updateProductDto,
  variantImageSchema,
  variantSchema,
} from './interface/http/products.contract'
export type {
  CreateProductInput,
  ListProductsQuery,
  Product,
  ProductImage,
  ProductVariant,
  UpdateProductInput,
  VariantImage,
} from './interface/http/products.contract'
export {
  serializeImage,
  serializeMedia,
  serializeProduct,
  serializeVariant,
} from './interface/presenters/product.presenter'
