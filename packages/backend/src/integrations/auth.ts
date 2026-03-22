import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";

import { prisma } from "./prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ac, owner, admin, member } from "@/libraries/permissions";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,
      roles: { owner, admin, member },
      dynamicAccessControl: { enabled: true },
    }),
    apiKey({
      references: "organization",
      enableSessionForAPIKeys: true,
      defaultPrefix: "bk_",
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60,
        maxRequests: 1000,
      },
    }),
  ],
});
