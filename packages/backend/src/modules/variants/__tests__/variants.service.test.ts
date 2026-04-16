import { describe, expect, it, mock } from 'bun:test'

import type { VariantRecord, VariantWithProductRecord } from '../domain/variant'
import type { VariantImageRecord } from '../domain/variant-image'
import type {
  VariantRepository,
  VariantSort,
} from '../domain/variant.repository'
import { createVariantsService } from '../application/variants.service'

const ORGANIZATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PRODUCT_ID = 'b1dcf8a6-7e1a-4f5d-a3c2-8e7f1b2c3d4e'
const VARIANT_ID = 'c2edf9b7-8f2b-4a6e-b4d3-9f8e2c3d4e5f'
const MEDIA_ID = 'e4f10bc9-aa4d-4c80-d6f5-b1c2d3e4f506'
const IMAGE_ID = 'f5012cda-bb5e-4d91-e7f6-c2d3e4f50617'

const defaultSort: VariantSort = {
  field: 'createdAt',
  order: 'desc',
}

const variantRecord: VariantRecord = {
  id: VARIANT_ID,
  organizationId: ORGANIZATION_ID,
  productId: PRODUCT_ID,
  sku: 'SKU-001',
  name: 'Test Variant',
  price: { toNumber: () => 9.99 },
  stock: 100,
  unit: 'pcs',
  attributes: {},
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  deletedAt: null,
  images: [],
}

const variantWithProductRecord: VariantWithProductRecord = {
  ...variantRecord,
  product: { name: 'Test Product' },
}

const variantImageRecord: VariantImageRecord = {
  id: IMAGE_ID,
  variantId: VARIANT_ID,
  mediaId: MEDIA_ID,
  altText: 'Front angle',
  sortOrder: 0,
  createdAt: new Date('2025-01-03T00:00:00.000Z'),
  media: {
    id: MEDIA_ID,
    organizationId: ORGANIZATION_ID,
    key: 'variants/sku-001/front.png',
    filename: 'front.png',
    contentType: 'image/png',
    size: 1024,
    purpose: 'variant-image',
    createdAt: new Date('2025-01-03T00:00:00.000Z'),
  },
}

type VariantRepositoryMethod<Name extends keyof VariantRepository> =
  VariantRepository[Name]
type VariantRepositoryInput<Name extends keyof VariantRepository> = Parameters<
  VariantRepositoryMethod<Name>
>[0]

function createDependencies() {
  const list = mock((_params: VariantRepositoryInput<'list'>) =>
    Promise.resolve({ data: [variantWithProductRecord], total: 1 }),
  )
  const listTrashed = mock((_params: VariantRepositoryInput<'listTrashed'>) =>
    Promise.resolve({ data: [variantWithProductRecord], total: 1 }),
  )
  const listByProduct = mock(
    (_params: VariantRepositoryInput<'listByProduct'>) =>
      Promise.resolve([variantRecord]),
  )
  const getById = mock((_params: VariantRepositoryInput<'getById'>) =>
    Promise.resolve(variantWithProductRecord),
  )
  const getBySku = mock((_params: VariantRepositoryInput<'getBySku'>) =>
    Promise.resolve(variantWithProductRecord),
  )
  const create = mock((_params: VariantRepositoryInput<'create'>) =>
    Promise.resolve(variantRecord),
  )
  const update = mock((_params: VariantRepositoryInput<'update'>) =>
    Promise.resolve({ count: 1 }),
  )
  const softDelete = mock((_params: VariantRepositoryInput<'softDelete'>) =>
    Promise.resolve(),
  )
  const restore = mock((_params: VariantRepositoryInput<'restore'>) =>
    Promise.resolve(),
  )
  const addImage = mock((_params: VariantRepositoryInput<'addImage'>) =>
    Promise.resolve(variantImageRecord),
  )
  const removeImage = mock((_params: VariantRepositoryInput<'removeImage'>) =>
    Promise.resolve({ count: 1 }),
  )

  const variantRepository = {
    list,
    listTrashed,
    listByProduct,
    getById,
    getBySku,
    create,
    update,
    softDelete,
    restore,
    addImage,
    removeImage,
  } satisfies VariantRepository

  const service = createVariantsService({
    variantRepository,
  })

  return {
    service,
    list,
    listTrashed,
    listByProduct,
    getById,
    getBySku,
    create,
    update,
    softDelete,
    restore,
    addImage,
    removeImage,
  }
}

describe('createVariantsService', () => {
  it('delegates listVariants to the repository', async () => {
    const { service, list } = createDependencies()

    const result = await service.listVariants(ORGANIZATION_ID, {
      skip: 10,
      take: 20,
      search: 'test',
      orderBy: defaultSort,
    })

    expect(result).toEqual({ data: [variantWithProductRecord], total: 1 })
    expect(list.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          skip: 10,
          take: 20,
          search: 'test',
          orderBy: defaultSort,
        },
      ],
    ])
  })

  it('delegates listTrashedVariants to the repository', async () => {
    const { service, listTrashed } = createDependencies()

    const result = await service.listTrashedVariants(ORGANIZATION_ID, {
      skip: 5,
      take: 10,
      search: 'archived',
      orderBy: defaultSort,
    })

    expect(result).toEqual({ data: [variantWithProductRecord], total: 1 })
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

  it('delegates listVariantsByProduct to the repository', async () => {
    const { service, listByProduct } = createDependencies()

    const result = await service.listVariantsByProduct(
      ORGANIZATION_ID,
      PRODUCT_ID,
    )

    expect(result).toEqual([variantRecord])
    expect(listByProduct.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, productId: PRODUCT_ID }],
    ])
  })

  it('delegates getVariant to the repository', async () => {
    const { service, getById } = createDependencies()

    const result = await service.getVariant(ORGANIZATION_ID, VARIANT_ID)

    expect(result).toBe(variantWithProductRecord)
    expect(getById.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: VARIANT_ID }],
    ])
  })

  it('delegates lookupBySku to the repository', async () => {
    const { service, getBySku } = createDependencies()

    const result = await service.lookupBySku(ORGANIZATION_ID, 'SKU-001')

    expect(result).toBe(variantWithProductRecord)
    expect(getBySku.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, sku: 'SKU-001' }],
    ])
  })

  it('delegates createVariant to the repository', async () => {
    const { service, create } = createDependencies()

    const result = await service.createVariant(ORGANIZATION_ID, PRODUCT_ID, {
      sku: 'SKU-001',
      name: 'Test Variant',
      price: 9.99,
      unit: 'pcs',
    })

    expect(result).toBe(variantRecord)
    expect(create.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          productId: PRODUCT_ID,
          sku: 'SKU-001',
          name: 'Test Variant',
          price: 9.99,
          unit: 'pcs',
        },
      ],
    ])
  })

  it('delegates updateVariant to the repository', async () => {
    const { service, update } = createDependencies()

    const result = await service.updateVariant(ORGANIZATION_ID, VARIANT_ID, {
      name: 'Updated Variant',
      price: 19.99,
    })

    expect(result).toEqual({ count: 1 })
    expect(update.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          id: VARIANT_ID,
          name: 'Updated Variant',
          price: 19.99,
        },
      ],
    ])
  })

  it('delegates deleteVariant to the repository', async () => {
    const { service, softDelete } = createDependencies()

    await service.deleteVariant(ORGANIZATION_ID, VARIANT_ID)

    expect(softDelete.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: VARIANT_ID }],
    ])
  })

  it('delegates restoreVariant to the repository', async () => {
    const { service, restore } = createDependencies()

    await service.restoreVariant(ORGANIZATION_ID, VARIANT_ID)

    expect(restore.mock.calls).toEqual([
      [{ organizationId: ORGANIZATION_ID, id: VARIANT_ID }],
    ])
  })

  it('delegates addVariantImage to the repository', async () => {
    const { service, addImage } = createDependencies()

    const result = await service.addVariantImage(ORGANIZATION_ID, VARIANT_ID, {
      mediaId: MEDIA_ID,
      altText: 'Front angle',
    })

    expect(result).toBe(variantImageRecord)
    expect(addImage.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          variantId: VARIANT_ID,
          mediaId: MEDIA_ID,
          altText: 'Front angle',
        },
      ],
    ])
  })

  it('delegates removeVariantImage to the repository', async () => {
    const { service, removeImage } = createDependencies()

    const result = await service.removeVariantImage(
      ORGANIZATION_ID,
      VARIANT_ID,
      IMAGE_ID,
    )

    expect(result).toEqual({ count: 1 })
    expect(removeImage.mock.calls).toEqual([
      [
        {
          organizationId: ORGANIZATION_ID,
          variantId: VARIANT_ID,
          imageId: IMAGE_ID,
        },
      ],
    ])
  })
})
