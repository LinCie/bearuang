import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
