export interface ProductCategoryTreeRepository {
  getDescendantCategoryIds(params: {
    organizationId: string
    rootCategoryId: string
  }): Promise<readonly string[]>
}
