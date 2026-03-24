import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/_dashboard/products')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({ to: '/signin' })
    }
  },
  component: ProductsLayout,
})

function ProductsLayout() {
  return <Outlet />
}
