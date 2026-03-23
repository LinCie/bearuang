import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'
import { apiKeyClient } from '@better-auth/api-key/client'

export const authClient = createAuthClient({
  baseURL: process.env.PUBLIC_BACKEND_URL || 'http://localhost:8000',
  basePath: '/auth',
  plugins: [organizationClient(), apiKeyClient()],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  useActiveOrganization,
  useListOrganizations,
} = authClient
