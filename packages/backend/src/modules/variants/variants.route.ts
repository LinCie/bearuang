import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { variantsService } from "./variants.service";

const createVariantDto = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const updateVariantDto = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  unit: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const variantIdParam = z.object({
  id: z.string().uuid(),
});

const productIdParam = z.object({
  id: z.string().uuid(),
});

const searchVariantQuery = z.object({
  search: z.string().optional(),
  skip: z.coerce.number().optional(),
  take: z.coerce.number().optional(),
});

export const variantsRoute = new Elysia({ tags: ["Variants"] })
  .use(authPlugin)

  // Product-scoped variant endpoints
  .group("/products/:id/variants", (app) =>
    app
      .get(
        "/",
        async ({ organization, params }) => {
          return variantsService.listVariantsByProduct(
            organization.id,
            params.id,
          );
        },
        {
          requireOrg: true,
          params: productIdParam,
          detail: {
            summary: "List product variants",
            description: "Retrieves all variants belonging to a specific product.",
          },
        },
      )
      .post(
        "/",
        async ({ organization, params, body, status }) => {
          try {
            const variant = await variantsService.createVariant(
              organization.id,
              params.id,
              body,
            );
            return status(201, variant);
          } catch (e: any) {
            // Prisma unique constraint error code
            if (e.code === "P2002") {
              return status(409, {
                message: `SKU "${body.sku}" already exists in this organization`,
              });
            }
            throw e;
          }
        },
        {
          requireOrg: true,
          params: productIdParam,
          body: createVariantDto,
          detail: {
            summary: "Create a product variant",
            description: "Creates a new variant for a specific product.",
          },
        },
      )
  )

  // Global variant endpoints
  .group("/variants", (app) =>
    app
      .get(
        "/",
        async ({ organization, query }) => {
          return variantsService.listVariants(organization.id, query);
        },
        {
          requireOrg: true,
          query: searchVariantQuery,
          detail: {
            summary: "Search all variants",
            description: "Globally search and list variants across the entire organization. Useful for comboboxes and quick lookups.",
          },
        },
      )
      .get(
        "/:id",
        async ({ organization, params, status }) => {
          const variant = await variantsService.getVariant(
            organization.id,
            params.id,
          );
          if (!variant) return status(404);
          return variant;
        },
        {
          requireOrg: true,
          params: variantIdParam,
          detail: {
            summary: "Get a variant",
            description: "Retrieves the details of a specific variant by its ID.",
          },
        },
      )
      .patch(
        "/:id",
        async ({ organization, params, body, status }) => {
          try {
            const count = await variantsService.updateVariant(
              organization.id,
              params.id,
              body,
            );
            if (count.count === 0) return status(404);
            return status(200);
          } catch (e: any) {
            if (e.code === "P2002") {
              return status(409, {
                message: `SKU "${body.sku}" already exists in this organization`,
              });
            }
            throw e;
          }
        },
        {
          requireOrg: true,
          params: variantIdParam,
          body: updateVariantDto,
          detail: {
            summary: "Update a variant",
            description: "Updates the details of an existing variant.",
          },
        },
      )
      .delete(
        "/:id",
        async ({ organization, params, status }) => {
          const count = await variantsService.deleteVariant(
            organization.id,
            params.id,
          );
          if (count.count === 0) return status(404);
          return status(200);
        },
        {
          requireOrg: true,
          params: variantIdParam,
          detail: {
            summary: "Delete a variant",
            description: "Soft-deletes a product variant by its ID.",
          },
        },
      )
  );
