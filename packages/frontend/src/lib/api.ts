import { treaty } from '@elysiajs/eden'
import type { App } from 'backend'

export const api = treaty<App>(
  process.env.PUBLIC_BACKEND_URL || 'http://localhost:8000',
  {
    fetch: { credentials: 'include' },
  },
)
