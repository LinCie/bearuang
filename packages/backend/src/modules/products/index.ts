import { createProductsService } from './application/products.service'
import { createAuditAdapter } from './infrastructure/audit/audit.adapter'
import { createPrismaProductCategoryTreeRepository } from './infrastructure/prisma/prisma-product-category-tree.repository'
import { createPrismaProductRepository } from './infrastructure/prisma/prisma-product.repository'
import { createProductsRoute } from './interface/http/products.route'

const productRepository = createPrismaProductRepository()
const productCategoryTreeRepository =
  createPrismaProductCategoryTreeRepository()
const productAuditPort = createAuditAdapter()

export const productsService = createProductsService({
  productRepository,
  productCategoryTreeRepository,
})

export const productsRoute = createProductsRoute({ productsService })

export { productRepository, productCategoryTreeRepository, productAuditPort }
export * from './application/products.service'
export * from './application/dto/list-products.dto'
export * from './application/dto/product.dto'
export * from './application/ports/audit.port'
export type {
  AddProductImageInput,
  CreateProductInput as CreateProductCommandInput,
  ProductIdentityInput,
  RemoveProductImageInput,
  ReorderProductImagesInput,
  UpdateProductInput as UpdateProductCommandInput,
} from './application/dto/mutate-product.dto'
export * from './domain/product'
export * from './domain/product-image'
export * from './domain/product.errors'
export * from './domain/product.repository'
export * from './domain/product-category-tree.repository'
export * from './interface/http/products.contract'
export * from './interface/http/products.route'
export * from './interface/presenters/product.presenter'
