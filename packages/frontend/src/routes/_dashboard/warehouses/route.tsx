import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/warehouses')({
  component: WarehousesLayout,
})

function WarehousesLayout() {
  return <Outlet />
}
