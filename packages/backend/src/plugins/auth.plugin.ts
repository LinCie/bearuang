import { auth } from "@/integrations/auth";
import { Elysia } from "elysia";

type Permission = Record<string, string[]>;

export const authPlugin = new Elysia({ name: "auth" }).macro({
  requireAuth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session) return status(401);

      const apiKey = headers.get("x-api-key");
      if (apiKey) {
        const result = await auth.api.verifyApiKey({ body: { key: apiKey } });
        if (!result.valid) return status(401);
      }

      return { user: session.user, session: session.session };
    },
  },
  requireOrg: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session) return status(401);

      const apiKey = headers.get("x-api-key");
      let organization;

      if (apiKey) {
        const result = await auth.api.verifyApiKey({
          body: { key: apiKey },
        });
        if (!result.valid || !result.key) return status(401);
        organization = await auth.api.getFullOrganization({
          headers,
          query: { organizationId: result.key.referenceId },
        });
      } else {
        organization = await auth.api.getFullOrganization({ headers });
      }

      if (!organization) return status(401);

      return {
        user: session.user,
        session: session.session,
        organization,
      };
    },
  },
  requirePermission(permissions: Permission) {
    return {
      async beforeHandle({ request: { headers }, status }) {
        const apiKey = headers.get("x-api-key");

        if (apiKey) {
          const result = await auth.api.verifyApiKey({
            body: { key: apiKey, permissions },
          });
          if (!result.valid) return status(403, "Forbidden");
        } else {
          const hasPerms = await auth.api.hasPermission({
            headers,
            body: { permissions },
          });
          if (!hasPerms) return status(403, "Forbidden");
        }
      },
    };
  },
});
