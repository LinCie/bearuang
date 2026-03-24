/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,slug]` on the table `product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "product" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_organizationId_slug_key" ON "product"("organizationId", "slug");
