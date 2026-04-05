import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import {
  dehydrate,
  onlineManager,
  QueryClientProvider,
} from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/query-client'
import {
  createPersister,
  restoreSync,
  shouldDehydrateQuery,
} from './lib/persister'
import './styles.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

onlineManager.setOnline(navigator.onLine)
restoreSync(queryClient)

const persister = createPersister()
let persistTimer: ReturnType<typeof setTimeout> | undefined

queryClient.getQueryCache().subscribe(() => {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const state = dehydrate(queryClient, { shouldDehydrateQuery })
    void persister.persistClient({
      clientState: state,
      timestamp: Date.now(),
      buster: '',
    })
  }, 1000)
})

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}
