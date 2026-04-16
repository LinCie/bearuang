export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} not found`)
    this.name = 'ProductNotFoundError'
  }
}
