import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/product-categories')({
  component: ProductCategoriesLayout,
})

function ProductCategoriesLayout() {
  return <Outlet />
}
