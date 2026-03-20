import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin } from "@/plugins/auth.plugin";
import { productsService } from "./products.service";

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
      return products;
    },
    {
      requireOrg: true,
      detail: {
        summary: "List products",
        description: "Retrieves a list of all products belonging to the authenticated organization.",
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
      return status(201, product);
    },
    {
      requireOrg: true,
      body: createProductDto,
      detail: {
        summary: "Create a product",
        description: "Creates a new product for the authenticated organization.",
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
      if (!product) return status(404);
      return product;
    },
    {
      requireOrg: true,
      params: productIdParam,
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
      if (count.count === 0) return status(404);
      return status(200);
    },
    {
      requireOrg: true,
      params: productIdParam,
      body: updateProductDto,
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
      return status(200);
    },
    {
      requireOrg: true,
      params: productIdParam,
      detail: {
        summary: "Delete a product",
        description: "Soft-deletes a product by its ID.",
      },
    },
  );
