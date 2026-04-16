import { describe, expect, it, mock } from 'bun:test'

import type { ProductRecord } from '../domain/product'
import type { ProductCategoryTreeRepository } from '../domain/product-category-tree.repository'
import type {
  ListProductsResult,
  ProductRepository,
  ProductSort,
} from '../domain/product.repository'
import type { ProductImageRecord } from '../domain/product-image'
import { createProductsService } from '../application/products.service'

const ORGANIZATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PRODUCT_ID = 'b1dcf8a6-7e1a-4f5d-a3c2-8e7f1b2c3d4e'
const CATEGORY_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'
const ROOT_CATEGORY_ID = 'd3f0fab8-9a3c-4b7f-c5e4-a0b1c2d3e4f5'
const IMAGE_ID = 'e4f10bc9-aa4d-4c80-d6f5-b1c2d3e4f506'
const MEDIA_ID = 'f5012cda-bb5e-4d91-e7f6-c2d3e4f50617'

const defaultSort: ProductSort = {
  field: 'createdAt',
  order: 'desc',
}

const productRecord: ProductRecord = {
  id: PRODUCT_ID,
  organizationId: ORGANIZATION_ID,
  categoryId: CATEGORY_ID,
  category: {
    id: CATEGORY_ID,
    name: 'Snacks',
    slug: 'snacks',
  },
  name: 'Bear Chips',
  slug: 'bear-chips',
  description: 'Crunchy test snack',
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  deletedAt: null,
  variants: [],
  images: [],
}

const listProductsResult: ListProductsResult = {
  data: [productRecord],
  total: 1,
}

const productImageRecord: ProductImageRecord = {
  id: IMAGE_ID,
  productId: PRODUCT_ID,
  mediaId: MEDIA_ID,
  altText: 'Front angle',
  sortOrder: 0,
  createdAt: new Date('2025-01-03T00:00:00.000Z'),
  media: {
    id: MEDIA_ID,
    organizationId: ORGANIZATION_ID,
    key: 'products/bear-chips/front-angle.png',
    filename: 'front-angle.png',
    contentType: 'image/png',
    size: 1024,
    purpose: 'product-image',
    createdAt: new Date('2025-01-03T00:00:00.000Z'),
  },
}

const descendantCategoryIds = [
  ROOT_CATEGORY_ID,
  '06070809-0a0b-4c0d-8e0f-101112131415',
] as const

type ProductRepositoryMethod<Name extends keyof ProductRepository> =
  ProductRepository[Name]
type ProductRepositoryInput<Name extends keyof ProductRepository> = Parameters<
  ProductRepositoryMethod<Name>
>[0]
type ProductCategoryTreeInput = Parameters<
  ProductCategoryTreeRepository['getDescendantCategoryIds']
>[0]

function createDependencies() {
  const list = mock((_params: ProductRepositoryInput<'list'>) =>
    Promise.resolve(listProductsResult),
  )
  const listTrashed = mock((_params: ProductRepositoryInput<'listTrashed'>) =>
    Promise.resolve(listProductsResult),
  )
  const getById = mock((_params: ProductRepositoryInput<'getById'>) =>
    Promise.resolve(productRecord),
  )
  const getBySlug = mock((_params: ProductRepositoryInput<'getBySlug'>) =>
    Promise.resolve(productRecord),
  )
  const create = mock((_params: ProductRepositoryInput<'create'>) =>
    Promise.resolve(productRecord),
  )
  const update = mock((_params: ProductRepositoryInput<'update'>) =>
    Promise.resolve({ count: 1 }),
  )
  const softDelete = mock((_params: ProductRepositoryInput<'softDelete'>) =>
    Promise.resolve(),
  )
  const restore = mock((_params: ProductRepositoryInput<'restore'>) =>
    Promise.resolve(),
  )
  const addImage = mock((_params: ProductRepositoryInput<'addImage'>) =>
    Promise.resolve(productImageRecord),
  )
  const removeImage = mock((_params: ProductRepositoryInput<'removeImage'>) =>
    Promise.resolve({ count: 1 }),
  )
  const reorderImages = mock(
    (_params: ProductRepositoryInput<'reorderImages'>) => Promise.resolve(),
  )

  const getDescendantCategoryIds = mock((_params: ProductCategoryTreeInput) =>
    Promise.resolve(descendantCategoryIds),
  )

  const productRepository = {
    list,
    listTrashed,
    getById,
    getBySlug,
    create,
    update,
    softDelete,
    restore,
    addImage,
    removeImage,
    reorderImages,
  } satisfies ProductRepository

  const productCategoryTreeRepository = {
    getDescendantCategoryIds,
  } satisfies ProductCategoryTreeRepository

  const service = createProductsService({
    productRepository,
    productCategoryTreeRepository,
  })

  return {
    service,
    list,
    listTrashed,
    getById,
    getBySlug,
    create,
    update,
    softDelete,
    restore,
    addImage,
    removeImage,
    reorderImages,
    getDescendantCategoryIds,
  }
}

describe('createProductsService', () => {
  it('delegates listProducts to the repository', async () => {
    const { service, list } = createDependencies()

    const result = await service.listProducts(ORGANIZATION_ID, {
      skip: 10,
      take: 20,
      search: 'bear',
      categoryId: CATEGORY_ID,
      orderBy: defaultSort,
    })

    expect(result).toBe(listProductsResult)
    expect(list.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          skip: 10,
          take: 20,
          search: 'bear',
          categoryId: CATEGORY_ID,
          orderBy: defaultSort,
        },
      ],
    ])
  })

  it('delegates listTrashedProducts to the repository', async () => {
    const { service, listTrashed } = createDependencies()

    const result = await service.listTrashedProducts(ORGANIZATION_ID, {
      skip: 5,
      take: 10,
      search: 'archived',
      orderBy: defaultSort,
    })

    expect(result).toBe(listProductsResult)
    expect(listTrashed.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          skip: 5,
          take: 10,
          search: 'archived',
          orderBy: defaultSort,
        },
      ],
    ])
  })

  it('delegates getProduct to the repository', async () => {
    const { service, getById } = createDependencies()

    const result = await service.getProduct(ORGANIZATION_ID, PRODUCT_ID)

    expect(result).toBe(productRecord)
    expect(getById.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: PRODUCT_ID }],
    ])
  })

  it('delegates lookupBySlug to the repository', async () => {
    const { service, getBySlug } = createDependencies()

    const result = await service.lookupBySlug(
      ORGANIZATION_ID,
      productRecord.slug,
    )

    expect(result).toBe(productRecord)
    expect(getBySlug.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, slug: productRecord.slug }],
    ])
  })

  it('delegates createProduct to the repository', async () => {
    const { service, create } = createDependencies()

    const result = await service.createProduct(ORGANIZATION_ID, {
      name: productRecord.name,
      slug: productRecord.slug,
      description: productRecord.description ?? undefined,
      isActive: productRecord.isActive,
      categoryId: productRecord.categoryId,
    })

    expect(result).toBe(productRecord)
    expect(create.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          name: productRecord.name,
          slug: productRecord.slug,
          description: productRecord.description ?? undefined,
          isActive: productRecord.isActive,
          categoryId: productRecord.categoryId,
        },
      ],
    ])
  })

  it('delegates updateProduct to the repository', async () => {
    const { service, update } = createDependencies()

    const result = await service.updateProduct(ORGANIZATION_ID, PRODUCT_ID, {
      name: 'Updated Bear Chips',
      isActive: false,
    })

    expect(result).toEqual({ count: 1 })
    expect(update.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          id: PRODUCT_ID,
          name: 'Updated Bear Chips',
          isActive: false,
        },
      ],
    ])
  })

  it('delegates deleteProduct to the repository', async () => {
    const { service, softDelete } = createDependencies()

    await service.deleteProduct(ORGANIZATION_ID, PRODUCT_ID)

    expect(softDelete.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: PRODUCT_ID }],
    ])
  })

  it('delegates restoreProduct to the repository', async () => {
    const { service, restore } = createDependencies()

    await service.restoreProduct(ORGANIZATION_ID, PRODUCT_ID)

    expect(restore.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: PRODUCT_ID }],
    ])
  })

  it('delegates addProductImage to the repository', async () => {
    const { service, addImage } = createDependencies()

    const result = await service.addProductImage(ORGANIZATION_ID, PRODUCT_ID, {
      mediaId: MEDIA_ID,
      altText: productImageRecord.altText ?? undefined,
    })

    expect(result).toBe(productImageRecord)
    expect(addImage.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          productId: PRODUCT_ID,
          mediaId: MEDIA_ID,
          altText: productImageRecord.altText ?? undefined,
        },
      ],
    ])
  })

  it('delegates removeProductImage to the repository', async () => {
    const { service, removeImage } = createDependencies()

    const result = await service.removeProductImage(
      ORGANIZATION_ID,
      PRODUCT_ID,
      IMAGE_ID,
    )

    expect(result).toEqual({ count: 1 })
    expect(removeImage.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          productId: PRODUCT_ID,
          imageId: IMAGE_ID,
        },
      ],
    ])
  })

  it('delegates reorderProductImages to the repository', async () => {
    const { service, reorderImages } = createDependencies()

    await service.reorderProductImages(ORGANIZATION_ID, PRODUCT_ID, [
      IMAGE_ID,
      '11121314-1516-4718-891a-1b1c1d1e1f20',
    ])

    expect(reorderImages.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          productId: PRODUCT_ID,
          imageIds: [IMAGE_ID, '11121314-1516-4718-891a-1b1c1d1e1f20'],
        },
      ],
    ])
  })

  it('resolves category descendants before listing by category tree', async () => {
    const { service, getDescendantCategoryIds, list } = createDependencies()

    const result = await service.listProductsByCategoryTree(
      ORGANIZATION_ID,
      ROOT_CATEGORY_ID,
      {
        skip: 1,
        take: 2,
        search: 'chips',
        orderBy: defaultSort,
      },
    )

    expect(result).toBe(listProductsResult)
    expect(getDescendantCategoryIds.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, rootCategoryId: ROOT_CATEGORY_ID }],
    ])
    expect(list.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          skip: 1,
          take: 2,
          search: 'chips',
          orderBy: defaultSort,
          categoryIds: descendantCategoryIds,
        },
      ],
    ])
  })
})
