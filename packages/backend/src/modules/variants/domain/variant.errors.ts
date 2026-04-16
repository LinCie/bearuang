export class VariantNotFoundError extends Error {
  constructor(variantId: string) {
    super(`Variant ${variantId} not found`)
    this.name = 'VariantNotFoundError'
  }
}
