import { auth } from "@/integrations/auth";
import { Elysia } from "elysia";
import { logger } from "@/libraries/utilities";

type Permission = Record<string, string[]>;

export const authPlugin = new Elysia({ name: "auth" }).macro({
  requireAuth: {
    async resolve({ status, request: { headers, url } }) {
      try {
        const session = await auth.api.getSession({ headers });
        if (!session) {
          logger.info({ url }, "requireAuth: no session found");
          return status(401);
        }

        const apiKey = headers.get("x-api-key");
        if (apiKey) {
          const result = await auth.api.verifyApiKey({
            body: { key: apiKey },
          });
          if (!result.valid) return status(401);
        }

        return { user: session.user, session: session.session };
      } catch (err) {
        logger.error({ err, url }, "requireAuth: exception thrown");
        return status(401);
      }
    },
  },
  requireOrg: {
    async resolve({ status, request: { headers, url } }) {
      try {
        const session = await auth.api.getSession({ headers });
        if (!session) {
          logger.info({ url }, "requireOrg: no session found");
          return status(401);
        }

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

        if (!organization) {
          logger.info({ url }, "requireOrg: no organization found");
          return status(401);
        }

        return {
          user: session.user,
          session: session.session,
          organization,
        };
      } catch (err) {
        logger.error({ err, url }, "requireOrg: exception thrown");
        return status(401);
      }
    },
  },
  requirePermission(permissions: Permission) {
    return {
      async beforeHandle({ request: { headers, url }, status }) {
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
          if (!hasPerms) {
            logger.info({ permissions, url }, "requirePermission: denied");
            return status(403, "Forbidden");
          }
        }
      },
    };
  },
});
