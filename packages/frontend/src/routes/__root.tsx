import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
      <Toaster position="top-center" richColors />
    </>
  )
}
