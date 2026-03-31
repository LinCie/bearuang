import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  useRegisterSW()

  return (
    <>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
      <Toaster position="top-center" richColors />
    </>
  )
}
