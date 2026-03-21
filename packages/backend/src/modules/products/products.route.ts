import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { productsService } from "./products.service";
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

const productSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  variants: z.array(variantSchema),
});

const createProductDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateProductDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const productIdParam = z.object({
  id: z.string().uuid(),
});

export const productsRoute = new Elysia({
  prefix: "/products",
  tags: ["Products"],
})
  .use(authPlugin)
  .get(
    "/",
    async ({ organization }) => {
      const products = await productsService.listProducts(organization.id);
      return products.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        deletedAt: p.deletedAt?.toISOString() ?? null,
        variants: p.variants.map((v) => ({
          ...v,
          price: v.price.toNumber(),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
          deletedAt: v.deletedAt?.toISOString() ?? null,
        })),
      }));
    },
    {
      requireOrg: true,
      response: {
        200: z.array(productSchema),
      },
      detail: {
        summary: "List products",
        description:
          "Retrieves a list of all products belonging to the authenticated organization.",
      },
    },
  )
  .post(
    "/",
    async ({ organization, body, status }) => {
      const product = await productsService.createProduct(
        organization.id,
        body,
      );
      return status(201, {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        deletedAt: product.deletedAt?.toISOString() ?? null,
        variants: product.variants.map((v) => ({
          ...v,
          price: v.price.toNumber(),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
          deletedAt: v.deletedAt?.toISOString() ?? null,
        })),
      });
    },
    {
      requireOrg: true,
      body: createProductDto,
      response: {
        201: productSchema,
      },
      detail: {
        summary: "Create a product",
        description:
          "Creates a new product for the authenticated organization.",
      },
    },
  )
  .get(
    "/:id",
    async ({ organization, params, status }) => {
      const product = await productsService.getProduct(
        organization.id,
        params.id,
      );
      if (!product) return status(404, { message: "Product not found" });
      return {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        deletedAt: product.deletedAt?.toISOString() ?? null,
        variants: product.variants.map((v) => ({
          ...v,
          price: v.price.toNumber(),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
          deletedAt: v.deletedAt?.toISOString() ?? null,
        })),
      };
    },
    {
      requireOrg: true,
      params: productIdParam,
      response: {
        200: productSchema,
        404: errorResponse,
      },
      detail: {
        summary: "Get a product",
        description: "Retrieves the details of a specific product by its ID.",
      },
    },
  )
  .patch(
    "/:id",
    async ({ organization, params, body, status }) => {
      const count = await productsService.updateProduct(
        organization.id,
        params.id,
        body,
      );
      if (count.count === 0)
        return status(404, { message: "Product not found" });
      return status(200, { message: "Product updated" });
    },
    {
      requireOrg: true,
      params: productIdParam,
      body: updateProductDto,
      response: {
        200: errorResponse,
        404: errorResponse,
      },
      detail: {
        summary: "Update a product",
        description: "Updates the details of an existing product.",
      },
    },
  )
  .delete(
    "/:id",
    async ({ organization, params, status }) => {
      await productsService.deleteProduct(organization.id, params.id);
      return status(200, { message: "Product deleted" });
    },
    {
      requireOrg: true,
      params: productIdParam,
      response: {
        200: errorResponse,
      },
      detail: {
        summary: "Delete a product",
        description: "Soft-deletes a product by its ID.",
      },
    },
  );
