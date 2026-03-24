import {
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
} from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: async ({ location }) => {
    try {
      const { data: session } = await authClient.getSession()

      if (!session) {
        throw redirect({
          to: '/signin',
          search: {
            redirect: location.href,
          },
        })
      }

      if (!session.session.activeOrganizationId) {
        throw redirect({
          to: '/organizations',
          search: {
            redirect: location.href,
          },
        })
      }
    } catch (error) {
      if (isRedirect(error)) throw error

      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      })
    }
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
