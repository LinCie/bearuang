import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { variantsService } from "./variants.service";
import { ProductVariant } from "@/generated/prisma/client";
import { errorResponse } from "@/common/error.response";

const variantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  organizationId: z.string(),
  sku: z.string(),
  name: z.string(),
  price: z.any(),
  stock: z.number(),
  unit: z.string(),
  attributes: z.any(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

const variantWithProductSchema = variantSchema.extend({
  product: z.object({ name: z.string() }),
});

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

const serializeVariant = (v: ProductVariant) => ({
  ...v,
  price: v.price.toNumber(),
  createdAt: v.createdAt.toISOString(),
  updatedAt: v.updatedAt.toISOString(),
  deletedAt: v.deletedAt?.toISOString() ?? null,
});

const serializeVariantWithProduct = (
  v: ProductVariant & { product: { name: string } },
) => ({
  ...serializeVariant(v),
  product: v.product,
});

export const variantsRoute = new Elysia({ tags: ["Variants"] })
  .use(authPlugin)

  // Product-scoped variant endpoints
  .group("/products/:id/variants", (app) =>
    app
      .get(
        "/",
        async ({ organization, params }) => {
          const variants = await variantsService.listVariantsByProduct(
            organization.id,
            params.id,
          );
          return variants.map(serializeVariant);
        },
        {
          requireOrg: true,
          params: productIdParam,
          response: {
            200: z.array(variantSchema),
          },
          detail: {
            summary: "List product variants",
            description:
              "Retrieves all variants belonging to a specific product.",
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
            return status(201, serializeVariant(variant));
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
          params: productIdParam,
          body: createVariantDto,
          response: {
            201: variantSchema,
            409: errorResponse,
          },
          detail: {
            summary: "Create a product variant",
            description: "Creates a new variant for a specific product.",
          },
        },
      ),
  )

  // Global variant endpoints
  .group("/variants", (app) =>
    app
      .get(
        "/",
        async ({ organization, query }) => {
          const variants = await variantsService.listVariants(
            organization.id,
            query,
          );
          return variants.map(serializeVariantWithProduct);
        },
        {
          requireOrg: true,
          query: searchVariantQuery,
          response: {
            200: z.array(variantWithProductSchema),
          },
          detail: {
            summary: "Search all variants",
            description:
              "Globally search and list variants across the entire organization. Useful for comboboxes and quick lookups.",
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
          if (!variant) return status(404, { message: "Variant not found" });
          return serializeVariantWithProduct(variant);
        },
        {
          requireOrg: true,
          params: variantIdParam,
          response: {
            200: variantWithProductSchema,
            404: errorResponse,
          },
          detail: {
            summary: "Get a variant",
            description:
              "Retrieves the details of a specific variant by its ID.",
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
            if (count.count === 0)
              return status(404, { message: "Variant not found" });
            return status(200, { message: "Variant updated" });
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
          response: {
            200: errorResponse,
            404: errorResponse,
            409: errorResponse,
          },
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
          if (count.count === 0)
            return status(404, { message: "Variant not found" });
          return status(200, { message: "Variant deleted" });
        },
        {
          requireOrg: true,
          params: variantIdParam,
          response: {
            200: errorResponse,
            404: errorResponse,
          },
          detail: {
            summary: "Delete a variant",
            description: "Soft-deletes a product variant by its ID.",
          },
        },
      ),
  );
