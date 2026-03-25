import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { membersService } from "./members.service";
import { errorResponse } from "@/common/error.response";
import {
  paginationQuery,
  paginatedResponse,
  buildPaginationMeta,
  paginationToSkipTake,
  sortQuery,
} from "@/common/pagination";

const memberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullish(),
});

export const memberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  role: z.string(),
  createdAt: z.iso.datetime(),
  userId: z.string(),
  user: memberUserSchema,
});

export const updateMemberRoleDto = z.object({
  role: z.string().min(1),
});

export const listMembersQuery = paginationQuery
  .extend(sortQuery(["role", "createdAt"]).shape)
  .extend({
    search: z.string().optional(),
  });

export type Member = z.infer<typeof memberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleDto>;
export type ListMembersQuery = z.infer<typeof listMembersQuery>;

const memberIdParam = z.object({
  id: z.string(),
});

type MemberData = {
  id: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  userId: string;
  user: { id: string; name: string; email: string; image?: string | null };
};

const serializeMember = (m: MemberData) => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
  user: {
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image ?? null,
  },
});

export const membersRoute = new Elysia({
  prefix: "/members",
  tags: ["Members"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization, query }) => {
      const { page, pageSize, search, sortBy, sortOrder } = query;
      const { skip, take } = paginationToSkipTake(page, pageSize);
      const { data, total } = await membersService.listMembers(
        organization.id,
        {
          skip,
          take,
          search,
          orderBy: sortBy
            ? { field: sortBy, order: sortOrder ?? "desc" }
            : undefined,
        },
      );
      return {
        data: (data as MemberData[]).map(serializeMember),
        meta: buildPaginationMeta(total, page, pageSize),
      };
    },
    {
      requireAuth: true,
      requireOrg: true,
      query: listMembersQuery,
      response: {
        200: paginatedResponse(memberSchema),
      },
      detail: {
        summary: "List members",
        description:
          "Retrieves a paginated list of members in the authenticated organization.",
      },
    },
  )
  .get(
    "/:id",
    async ({ organization, params, status }) => {
      const member = await membersService.getMember(
        organization.id,
        params.id,
      );
      if (!member) return status(404, { message: "Member not found" });
      return serializeMember(member as MemberData);
    },
    {
      requireAuth: true,
      requireOrg: true,
      params: memberIdParam,
      response: {
        200: memberSchema,
        404: errorResponse,
      },
      detail: {
        summary: "Get a member",
        description: "Retrieves the details of a specific member by their ID.",
      },
    },
  )
  .patch(
    "/:id",
    async ({ request, params, body, status }) => {
      try {
        const member = await membersService.updateMemberRole(
          request.headers,
          params.id,
          body.role,
        );
        return serializeMember(member as unknown as MemberData);
      } catch (e) {
        return status(404, { message: "Member not found" });
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { member: ["update"] },
      params: memberIdParam,
      body: updateMemberRoleDto,
      response: {
        200: memberSchema,
        404: errorResponse,
      },
      detail: {
        summary: "Update a member's role",
        description:
          "Updates the role of an existing member in the organization.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ request, params, status }) => {
      try {
        await membersService.removeMember(request.headers, params.id);
        return status(200, { message: "Member removed" });
      } catch (e) {
        return status(404, { message: "Member not found" });
      }
    },
    {
      requireAuth: true,
      requireOrg: true,
      requirePermission: { member: ["delete"] },
      params: memberIdParam,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Remove a member",
        description: "Removes a member from the authenticated organization.",
      },
    },
  );
