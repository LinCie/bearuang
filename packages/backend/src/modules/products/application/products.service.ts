import type {
  ProductRepository,
  ProductSort,
} from '../domain/product.repository'
import type { ProductCategoryTreeRepository } from '../domain/product-category-tree.repository'
import { createAddProductImage } from './commands/add-product-image'
import { createCreateProduct } from './commands/create-product'
import { createDeleteProduct } from './commands/delete-product'
import { createRemoveProductImage } from './commands/remove-product-image'
import { createReorderProductImages } from './commands/reorder-product-images'
import { createRestoreProduct } from './commands/restore-product'
import { createUpdateProduct } from './commands/update-product'
import { createGetProduct } from './queries/get-product'
import { createGetProductBySlug } from './queries/get-product-by-slug'
import { createListProducts } from './queries/list-products'
import { createListProductsByCategoryTree } from './queries/list-products-by-category-tree'
import { createListTrashedProducts } from './queries/list-trashed-products'

interface ProductsServiceDependencies {
  productRepository: ProductRepository
  productCategoryTreeRepository: ProductCategoryTreeRepository
}

interface ListProductsParams {
  skip?: number
  take?: number
  search?: string
  categoryId?: string | null
  orderBy?: ProductSort
}

interface ListProductsByCategoryTreeParams {
  skip?: number
  take?: number
  search?: string
  orderBy?: ProductSort
}

interface CreateProductParams {
  name: string
  slug: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

interface UpdateProductParams {
  name?: string
  slug?: string
  description?: string
  isActive?: boolean
  categoryId?: string | null
}

export interface ProductsService {
  listProducts(
    organizationId: string,
    params?: ListProductsParams,
  ): ReturnType<ReturnType<typeof createListProducts>>
  listTrashedProducts(
    organizationId: string,
    params?: Omit<ListProductsParams, 'categoryId'>,
  ): ReturnType<ReturnType<typeof createListTrashedProducts>>
  getProduct(
    organizationId: string,
    id: string,
  ): ReturnType<ReturnType<typeof createGetProduct>>
  lookupBySlug(
    organizationId: string,
    slug: string,
  ): ReturnType<ReturnType<typeof createGetProductBySlug>>
  createProduct(
    organizationId: string,
    data: CreateProductParams,
  ): ReturnType<ReturnType<typeof createCreateProduct>>
  updateProduct(
    organizationId: string,
    id: string,
    data: UpdateProductParams,
  ): ReturnType<ReturnType<typeof createUpdateProduct>>
  deleteProduct(organizationId: string, id: string): Promise<void>
  restoreProduct(organizationId: string, id: string): Promise<void>
  addProductImage(
    organizationId: string,
    productId: string,
    data: { mediaId: string; altText?: string },
  ): ReturnType<ReturnType<typeof createAddProductImage>>
  removeProductImage(
    organizationId: string,
    productId: string,
    imageId: string,
  ): ReturnType<ReturnType<typeof createRemoveProductImage>>
  reorderProductImages(
    organizationId: string,
    productId: string,
    imageIds: string[],
  ): Promise<void>
  listProductsByCategoryTree(
    organizationId: string,
    rootCategoryId: string,
    params?: ListProductsByCategoryTreeParams,
  ): ReturnType<ReturnType<typeof createListProductsByCategoryTree>>
}

export function createProductsService({
  productRepository,
  productCategoryTreeRepository,
}: ProductsServiceDependencies): ProductsService {
  const listProducts = createListProducts({ productRepository })
  const listTrashedProducts = createListTrashedProducts({ productRepository })
  const getProduct = createGetProduct({ productRepository })
  const getProductBySlug = createGetProductBySlug({ productRepository })
  const createProduct = createCreateProduct({ productRepository })
  const updateProduct = createUpdateProduct({ productRepository })
  const deleteProduct = createDeleteProduct({ productRepository })
  const restoreProduct = createRestoreProduct({ productRepository })
  const addProductImage = createAddProductImage({ productRepository })
  const removeProductImage = createRemoveProductImage({ productRepository })
  const reorderProductImages = createReorderProductImages({
    productRepository,
  })
  const listProductsByCategoryTree = createListProductsByCategoryTree({
    productRepository,
    productCategoryTreeRepository,
  })

  return {
    listProducts(organizationId, params) {
      return listProducts({ organizationId, ...params })
    },
    listTrashedProducts(organizationId, params) {
      return listTrashedProducts({ organizationId, ...params })
    },
    getProduct(organizationId, id) {
      return getProduct({ organizationId, id })
    },
    lookupBySlug(organizationId, slug) {
      return getProductBySlug({ organizationId, slug })
    },
    createProduct(organizationId, data) {
      return createProduct({ organizationId, ...data })
    },
    updateProduct(organizationId, id, data) {
      return updateProduct({ organizationId, id, ...data })
    },
    deleteProduct(organizationId, id) {
      return deleteProduct({ organizationId, id })
    },
    restoreProduct(organizationId, id) {
      return restoreProduct({ organizationId, id })
    },
    addProductImage(organizationId, productId, data) {
      return addProductImage({
        organizationId,
        productId,
        mediaId: data.mediaId,
        altText: data.altText,
      })
    },
    removeProductImage(organizationId, productId, imageId) {
      return removeProductImage({ organizationId, productId, imageId })
    },
    reorderProductImages(organizationId, productId, imageIds) {
      return reorderProductImages({ organizationId, productId, imageIds })
    },
    listProductsByCategoryTree(organizationId, rootCategoryId, params) {
      return listProductsByCategoryTree({
        organizationId,
        rootCategoryId,
        ...params,
      })
    },
  }
}
