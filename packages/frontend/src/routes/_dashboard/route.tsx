import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { sessionQueryOptions } from '@/lib/session'
import { permissionsQueryOptions } from '@/lib/use-permissions'

const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/products': 'product',
  '/warehouses': 'warehouse',
  '/stock-movements': 'stock',
  '/suppliers': 'supplier',
  '/customers': 'customer',
  '/purchase-orders': 'purchaseOrder',
  '/sales-orders': 'salesOrder',
  '/members': 'member',
}

export const Route = createFileRoute('/_dashboard')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions)

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

    // Check view permission for the current route
    const permissions = await context.queryClient.ensureQueryData(
      permissionsQueryOptions(),
    )
    const requiredResource = Object.entries(ROUTE_PERMISSION_MAP).find(
      ([route]) =>
        location.pathname === route ||
        location.pathname.startsWith(route + '/'),
    )?.[1]

    if (requiredResource && !permissions.viewResources.has(requiredResource)) {
      throw redirect({ to: '/' })
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
