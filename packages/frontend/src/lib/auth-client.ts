import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { apiKeyClient } from "@better-auth/api-key/client"

export const authClient = createAuthClient({
  baseURL: "http://localhost:8000",
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
