import { auth } from "@/integrations/auth";
import { Elysia } from "elysia";

type Permission = Record<string, string[]>;

export const authPlugin = new Elysia({ name: "auth" }).macro({
  requireAuth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });

      if (!session) return status(401);

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
  requireOrg: {
    async resolve({ status, request: { headers } }) {
      const organization = await auth.api.getFullOrganization({ headers });
      if (!organization) return status(401);

      return {
        organization,
      };
    },
  },
  requirePermission(permissions: Permission) {
    return {
      async beforeHandle({ request: { headers }, status }) {
        const result = await auth.api.hasPermission({
          headers,
          body: { permissions },
        });
        if (!result) return status(403, "Forbidden");
      },
    };
  },
});
