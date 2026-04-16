import { getPublicUrl } from '#integrations/s3'
import type { ProductRecord, ProductVariantRecord } from '../../domain/product'
import type {
  MediaRecord,
  ProductImageRecord,
  VariantImageRecord,
} from '../../domain/product-image'
import type {
  Product,
  ProductImage,
  ProductVariant,
  VariantImage,
} from '../http/products.contract'

export function serializeMedia(media: MediaRecord) {
  return {
    ...media,
    url: getPublicUrl(media.key),
    createdAt: media.createdAt.toISOString(),
  }
}

export function serializeProductImage(image: ProductImageRecord): ProductImage {
  return {
    ...image,
    createdAt: image.createdAt.toISOString(),
    media: serializeMedia(image.media),
  }
}

export function serializeVariantImage(image: VariantImageRecord): VariantImage {
  return {
    ...image,
    createdAt: image.createdAt.toISOString(),
    media: serializeMedia(image.media),
  }
}

export function serializeImage(image: ProductImageRecord): ProductImage
export function serializeImage(image: VariantImageRecord): VariantImage
export function serializeImage(
  image: ProductImageRecord | VariantImageRecord,
): ProductImage | VariantImage {
  if ('productId' in image) {
    return serializeProductImage(image)
  }

  return serializeVariantImage(image)
}

export function serializeVariant(
  variant: ProductVariantRecord,
): ProductVariant {
  return {
    ...variant,
    price: variant.price.toNumber(),
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
    deletedAt: variant.deletedAt?.toISOString() ?? null,
    images: variant.images.map(serializeVariantImage),
  }
}

export function serializeProduct(product: ProductRecord): Product {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    deletedAt: product.deletedAt?.toISOString() ?? null,
    variants: product.variants.map(serializeVariant),
    images: product.images.map(serializeProductImage),
  }
}
