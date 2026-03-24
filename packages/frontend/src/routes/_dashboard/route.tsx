import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { sessionQueryOptions } from '@/lib/session'

export const Route = createFileRoute('/_dashboard')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    )

    if (!session) {
      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      })
    }

    if (!session.session.activeOrganizationId) {
      throw redirect({
        to: '/organizations',
        search: { redirect: location.href },
      })
    }

    return { session }
  },
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
