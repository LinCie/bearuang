import { getPublicUrl } from '#integrations/s3'
import type {
  VariantRecord,
  VariantWithProductRecord,
} from '../../domain/variant'
import type {
  MediaRecord,
  VariantImageRecord,
} from '../../domain/variant-image'
import type {
  Variant,
  VariantImage,
  VariantWithProduct,
} from '../http/variants.contract'

export function serializeMedia(media: MediaRecord) {
  return {
    ...media,
    url: getPublicUrl(media.key),
    createdAt: media.createdAt.toISOString(),
  }
}

export function serializeVariantImage(image: VariantImageRecord): VariantImage {
  return {
    ...image,
    createdAt: image.createdAt.toISOString(),
    media: serializeMedia(image.media),
  }
}

export function serializeVariant(variant: VariantRecord): Variant {
  return {
    ...variant,
    price: variant.price.toNumber(),
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
    deletedAt: variant.deletedAt?.toISOString() ?? null,
    images: variant.images.map(serializeVariantImage),
  }
}

export function serializeVariantWithProduct(
  variant: VariantWithProductRecord,
): VariantWithProduct {
  return {
    ...serializeVariant(variant),
    product: variant.product,
  }
}
